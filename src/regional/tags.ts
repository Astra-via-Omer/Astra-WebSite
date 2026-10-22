import { consentSignals, mayLoadTags, tagManagerId, type Consent } from './consent';

declare global { interface Window { dataLayer?: unknown[] } }

export function startTagManager(input: { id: string | null; consent: Consent | null; privacySignal: boolean; pathname: string }) {
  const id = tagManagerId(input.id ?? undefined);
  if (!id || !mayLoadTags(input.consent, input.privacySignal, input.pathname)) return false;
  if (document.getElementById('astra-gtm')) return true;
  const layer = window.dataLayer = window.dataLayer ?? [];
  function command(..._args: unknown[]) { layer.push(arguments); }
  // Basic consent mode: no Google request, including cookieless pings, before opt-in.
  command('consent', 'default', consentSignals(null));
  command('set', 'ads_data_redaction', true);
  command('consent', 'update', consentSignals(input.consent));
  layer.push({ event: 'astra_consent', astra_analytics: !!input.consent?.analytics, astra_advertising: !!input.consent?.advertising });
  layer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.id = 'astra-gtm'; script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  document.head.appendChild(script);
  return true;
}
