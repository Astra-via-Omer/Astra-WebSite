import { getRegionalContext } from '@/regional/server';
import { REGION_LABELS } from '@/regional/policy';

export async function HebrewContent({ children }: { children: React.ReactNode }) {
  return (await getRegionalContext()).showHebrew ? children : null;
}

export default async function RegionalNotice() {
  const context = await getRegionalContext();
  return <aside className="notice regional-notice" aria-label="Regional information">
    <p><strong>Regional information: {REGION_LABELS[context.region]}</strong></p>
    {context.region === 'israel' && <p>The Israeli privacy and accessibility information on this page applies alongside any other mandatory protections. Hebrew information is available when the connection is estimated to be in Israel.</p>}
    {context.region === 'eea' && <p>Where the GDPR applies, you may request access, correction, erasure, restriction or portability of your personal data, object to processing, withdraw optional consent, and complain to your supervisory authority, subject to the conditions in the law. Contact support@astra-via.com to exercise your rights.</p>}
    {context.region === 'uk' && <p>Where UK data protection law applies, you may request access, correction, erasure, restriction or portability, object to processing, withdraw optional consent, and complain to the Information Commissioner’s Office, subject to the conditions in the law. Contact support@astra-via.com to exercise your rights.</p>}
    {context.region === 'us' && <p>Depending on your state and the applicable law, you may have rights to access, correct or delete personal information, obtain a copy, or opt out of sale, sharing or targeted advertising. Contact support@astra-via.com; include your state so we can assess the request. We honor Global Privacy Control by keeping optional website tags off.</p>}
    <p>Optional tracking is off until you choose it. Your connection country is an estimate and may reflect a VPN. A region choice changes which information we highlight; it does not determine your legal rights or where product data is stored. Mandatory protections and accurate company disclosures remain available in every region.</p>
    <a href="/region">Change regional information and privacy choices</a>
  </aside>;
}
