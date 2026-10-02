import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

export const metadata = {
  title: 'Try the workspace demo | Astra-via',
  description: 'Explore Astra-via’s early workspace preview: read sources, gather exact passages and follow page references.'
};
export default function Page() {
  return <div className="demo-page">
    <a className="skip" href="#main-content">Skip to content</a><SiteHeader active="demo" />
    <main id="main-content" tabIndex={-1}>
      <section className="demo-intro" aria-labelledby="demo-title">
        <p className="eyebrow">Astra workspace / Early preview</p>
        <h1 id="demo-title">Follow a source.<br />Build an evidence trail.</h1>
        <p className="page-intro">Step inside the workspace behind our approach. Read a source, collect the passages that matter and keep a clear path back to the original page.</p>
        <a className="demo-launch" href="https://workspace.astra-via.com/">Open workspace demo <span aria-hidden="true">↗</span></a>
        <p className="demo-launch-note">Opens workspace.astra-via.com. An active demo account is required to open sources.</p>
      </section>
      <section className="demo-steps" aria-label="Explore the demo">
        <article><span aria-hidden="true">01</span><h2>Start with a source.</h2><p>Sign in with an active demo account, then open the built-in Astra source deck for a guided example or choose a non-sensitive PDF.</p></article>
        <article><span aria-hidden="true">02</span><h2>Keep the original in view.</h2><p>Read closely, gather exact passages and keep their page references alongside your interpretation.</p></article>
        <article><span aria-hidden="true">03</span><h2>Explore the connections.</h2><p>Use the Gravity Well to explore connections between your sources and saved passages.</p></article>
      </section>
      <aside className="demo-preview-notice" aria-labelledby="preview-title">
        <p className="eyebrow">Before you begin</p><h2 id="preview-title">A preview for exploration.</h2>
        <ul><li>Source access requires an active demo account. <a href="mailto:support@astra-via.com?subject=Astra%20workspace%20demo%20access">Request demo access</a> through our shared support inbox.</li><li>The workspace currently labels PDF and notes storage as a temporary session: they clear on reload or close. Secure persistent storage is planned.</li><li>Automated AI analysis is not available in the current preview. This demo explores source reading and evidence organization; it does not independently verify claims or deliver a completed AI assessment.</li><li>Start with the built-in example. Avoid confidential, personal or sensitive documents, and keep your own copies of anything you need.</li></ul>
        <p>Questions or feedback? <a href="mailto:support@astra-via.com">support@astra-via.com</a>. We use the details you send to respond. <Link href="/privacy">Privacy & cookies</Link>.</p>
      </aside>
      <div className="demo-bottom"><Link href="/story">Revisit the Astra approach</Link><a className="demo-launch" href="https://workspace.astra-via.com/">Explore the demo <span aria-hidden="true">↗</span></a></div>
    </main><SiteFooter />
  </div>;
}
