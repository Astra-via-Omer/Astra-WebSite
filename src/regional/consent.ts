export const CONSENT_COOKIE = 'astra-consent';
export const CONSENT_VERSION = '2026-10-22';
export const CONSENT_SECONDS = 60 * 60 * 24 * 180;
export type Consent = { version: typeof CONSENT_VERSION; analytics: boolean; advertising: boolean; savedAt: number };

export function parseConsent(raw: string | undefined, now = Date.now()): Consent | null {
  if (!raw || raw.length > 1000) return null;
  try {
    const item = JSON.parse(decodeURIComponent(raw));
    if (item.version !== CONSENT_VERSION || typeof item.analytics !== 'boolean' || typeof item.advertising !== 'boolean'
      || !Number.isFinite(item.savedAt) || item.savedAt > now || now - item.savedAt > CONSENT_SECONDS * 1000) return null;
    return { version: CONSENT_VERSION, analytics: item.analytics, advertising: item.advertising, savedAt: item.savedAt };
  } catch { return null; }
}

export function consentSignals(consent: Pick<Consent, 'analytics' | 'advertising'> | null, privacySignal = false) {
  return {
    analytics_storage: consent?.analytics && !privacySignal ? 'granted' : 'denied',
    ad_storage: consent?.advertising && !privacySignal ? 'granted' : 'denied',
    ad_user_data: consent?.advertising && !privacySignal ? 'granted' : 'denied',
    ad_personalization: consent?.advertising && !privacySignal ? 'granted' : 'denied',
  };
}

export function mayLoadTags(consent: Consent | null, privacySignal: boolean, pathname: string) {
  // Accounts, investor documents, recovery URLs and APIs never load marketing tags.
  const publicPaths = ['/', '/story', '/philosophy', '/team', '/what-we-can-do', '/demo'];
  return publicPaths.includes(pathname) && !privacySignal && !!(consent?.analytics || consent?.advertising);
}

export function tagManagerId(value: string | undefined): string | null {
  return value && /^GTM-[A-Z0-9]{4,20}$/.test(value) ? value : null;
}
