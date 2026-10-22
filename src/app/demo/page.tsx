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
        <a className="demo-launch" href="/register">Start free · 100 credits <span aria-hidden="true">↗</span></a>
        <p className="demo-launch-note">Create your free Astra account to check PDFs in Workspace with 100 starting credits. Additional features and products require administrator approval.</p>
      </section>
      <section className="demo-steps" aria-label="Explore the demo">
        <article><span aria-hidden="true">01</span><h2>Start with a source.</h2><p>Create a free account or sign in, then open the built-in Astra source deck for a guided example or choose a non-sensitive PDF.</p></article>
        <article><span aria-hidden="true">02</span><h2>Keep the original in view.</h2><p>Read closely, gather exact passages and keep their page references alongside your interpretation.</p></article>
        <article><span aria-hidden="true">03</span><h2>Explore the connections.</h2><p>Use the Gravity Well to explore connections between your sources and saved passages.</p></article>
      </section>
      <aside className="demo-preview-notice" aria-labelledby="preview-title">
        <p className="eyebrow">Before you begin</p><h2 id="preview-title">A preview for exploration.</h2>
        <ul><li>Start with <a href="/register">a free account and 100 credits</a>. Other Workspace features and Astra products require administrator approval.</li><li>Connected Workspace storage retains your PDFs and completed reviews in your private history.</li><li>PDF checking uses credits to examine claims against supplied evidence. AI assessments do not independently verify whether claims are true.</li><li>Start with the built-in example. Avoid confidential, personal or sensitive documents, and keep your own copies of anything you need.</li></ul>
        <p>Questions or feedback? <a href="mailto:support@astra-via.com">support@astra-via.com</a>. We use the details you send to respond. <Link href="/privacy">Privacy & cookies</Link>.</p>
      </aside>
      <div className="demo-bottom"><Link href="/story">Revisit the Astra approach</Link><a className="demo-launch" href="https://workspace.astra-via.com/">Explore the demo <span aria-hidden="true">↗</span></a></div>
    </main><SiteFooter />
  </div>;
}
