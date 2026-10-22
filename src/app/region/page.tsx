import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import { getRegionalContext } from '@/regional/server';
import { REGIONS, REGION_LABELS } from '@/regional/policy';
import { chooseRegion, useConnectionRegion } from './actions';
import { PrivacyChoices } from '@/components/PrivacyControls';

export const metadata = { title: 'Region & privacy choices | Astra-via' };
export default async function Page() {
  const context = await getRegionalContext();
  return <><a className="skip" href="#main-content">Skip to content</a><SiteHeader />
    <main id="main-content" tabIndex={-1} className="legal-page">
      <p className="eyebrow">Astra-via · Your choices</p><h1>Region & privacy</h1>
      <p>Connection country estimate: <strong>{context.country ?? 'Unavailable'}</strong>. VPNs and proxies can change this estimate.</p>
      <p>Choose the regional information relevant to you. This does not change your legal rights, account access, or the location of your data.</p>
      <form action={chooseRegion} className="region-form">
        <label htmlFor="region">Regional information</label>
        <select id="region" name="region" defaultValue={context.region}>{REGIONS.map(region => <option key={region} value={region}>{REGION_LABELS[region]}</option>)}</select>
        <button type="submit">Save region</button>
      </form>
      <form action={useConnectionRegion}><button className="privacy-button" type="submit">Use connection estimate</button></form>
      <section aria-labelledby="privacy-choices"><h2 id="privacy-choices">Optional tracking</h2><PrivacyChoices /></section>
      <p><a href="/privacy">Privacy & cookies</a> · <a href="/legal">Terms & disclaimer</a> · <a href="/accessibility">Accessibility</a></p>
    </main><SiteFooter /></>;
}
