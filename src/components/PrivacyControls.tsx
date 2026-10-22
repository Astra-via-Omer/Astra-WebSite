'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CONSENT_COOKIE, CONSENT_SECONDS, CONSENT_VERSION, parseConsent, type Consent } from '@/regional/consent';
import { startTagManager } from '@/regional/tags';

type PrivacyState = { enabled: boolean; ready: boolean; privacySignal: boolean; consent: Consent | null; save: (analytics: boolean, advertising: boolean) => void };
const PrivacyContext = createContext<PrivacyState>({ enabled: false, ready: false, privacySignal: false, consent: null, save: () => {} });

export function PrivacyProvider({ containerId, serverPrivacySignal, children }: { containerId: string | null; serverPrivacySignal: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);
  const [privacySignal, setPrivacySignal] = useState(serverPrivacySignal);
  useEffect(() => {
    const signal = serverPrivacySignal || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === '1';
    setPrivacySignal(signal);
    setConsent(parseConsent(document.cookie.split('; ').find(item => item.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1)));
    setReady(true);
  }, [serverPrivacySignal]);
  useEffect(() => {
    if (ready) startTagManager({ id: containerId, consent, privacySignal, pathname });
  }, [containerId, consent, ready, privacySignal, pathname]);
  const save = (analytics: boolean, advertising: boolean) => {
    const value: Consent = { version: CONSENT_VERSION, analytics: analytics && !privacySignal, advertising: advertising && !privacySignal, savedAt: Date.now() };
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; SameSite=Lax; Max-Age=${CONSENT_SECONDS}${location.protocol === 'https:' ? '; Secure' : ''}`;
    // A fresh document also stops already-running tags when permission is reduced.
    window.location.reload();
  };
  return <PrivacyContext.Provider value={{ enabled: !!containerId, ready, privacySignal, consent, save }}>{children}<ConsentBanner /></PrivacyContext.Provider>;
}

export function PrivacyChoices() {
  const { enabled, ready, privacySignal, consent, save } = useContext(PrivacyContext);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  useEffect(() => { setAnalytics(!!consent?.analytics); setAdvertising(!!consent?.advertising); }, [consent]);
  if (!enabled) return <p>Optional analytics and advertising are currently disabled. Regional preferences are saved only when you choose a region.</p>;
  if (!ready) return <p>Loading your privacy choices…</p>;
  return <div className="privacy-choices">
    <p>Essential website delivery and security work without optional tracking. Your choice is saved in a first-party cookie for up to 180 days. You can change it here at any time.</p>
    {privacySignal && <p role="status">Your browser’s privacy signal is active. Optional analytics and advertising stay off.</p>}
    <label><input type="checkbox" checked={!privacySignal && analytics} disabled={privacySignal} onChange={event => setAnalytics(event.target.checked)} />Allow analytics through Google tags</label>
    <label><input type="checkbox" checked={!privacySignal && advertising} disabled={privacySignal} onChange={event => setAdvertising(event.target.checked)} />Allow advertising through Google tags</label>
    <div className="privacy-actions"><button type="button" onClick={() => save(analytics, advertising)}>Save choices</button><button type="button" onClick={() => save(false, false)}>Reject optional tracking</button></div>
    <p>Saving reloads this page to apply your choice. Withdrawing consent stops future optional tags on this site; it does not automatically erase data already sent to a provider.</p>
  </div>;
}

function ConsentBanner() {
  const pathname = usePathname();
  const { enabled, ready, privacySignal, consent, save } = useContext(PrivacyContext);
  if (!enabled || !ready || privacySignal || consent || pathname === '/region' || pathname.startsWith('/investors') || pathname.startsWith('/register')) return null;
  return <section className="consent-banner" aria-labelledby="consent-title">
    <h2 id="consent-title">Your privacy choices</h2>
    <p>Optional analytics and advertising stay off unless you allow them. You can browse without accepting.</p>
    <div className="privacy-actions"><button type="button" onClick={() => save(false, false)}>Reject optional tracking</button><button type="button" onClick={() => save(true, false)}>Allow analytics only</button><a href="/region">Choose settings</a><a href="/privacy">Privacy notice</a></div>
  </section>;
}
