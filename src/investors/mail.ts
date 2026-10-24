import { emailField } from './policy';

export type MailConfig = { tenantId: string; clientId: string; clientSecret: string; sender: string };
export function mailConfig(value: string | undefined): MailConfig | null {
  try {
    const config = JSON.parse(value || '{}');
    const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id.test(config.tenantId) || !id.test(config.clientId) || typeof config.clientSecret !== 'string' || !config.clientSecret.trim()) return null;
    return { tenantId: config.tenantId, clientId: config.clientId, clientSecret: config.clientSecret, sender: emailField(config.sender) };
  } catch { return null; }
}
export function recoveryUrl(token: string) {
  if (!/^[a-zA-Z0-9_-]{32,256}$/.test(token)) throw Error('Invalid recovery token');
  // Fixed origin: request headers and submitted redirect URLs cannot redirect a reset.
  return 'https://astra-via.com/investors#token_hash=' + encodeURIComponent(token) + '&type=recovery';
}
export async function sendRecoveryEmail(config: MailConfig, recipient: string, token: string, transport: typeof fetch = fetch) {
  const email = emailField(recipient), link = recoveryUrl(token);
  const response = await transport(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
  });
  if (!response.ok) throw Error('Mail authentication failed');
  const access = await response.json();
  if (typeof access.access_token !== 'string' || !access.access_token) throw Error('Mail authentication failed');
  const sent = await transport(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.sender)}/sendMail`, {
    method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: 'Bearer ' + access.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { subject: 'Reset your Astra-via Investor Room password', body: { contentType: 'Text', content: `A password reset was requested for your Astra-via Investor Room account.\n\nOpen this single-use link to choose a new password:\n${link}\n\nThe link expires under the account security settings. If you did not request this, ignore this message. Your password and access permissions have not changed. Never forward this link.\n\nFor help, contact support@astra-via.com.` }, toRecipients: [{ emailAddress: { address: email } }] }, saveToSentItems: false }),
  });
  // Accepted by Microsoft is distinct from confirmed inbox delivery.
  if (sent.status !== 202) throw Error('Mail provider rejected the request');
}
