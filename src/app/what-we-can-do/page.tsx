import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import { products } from '@/data/products';

export const metadata = {
  title: 'What we can do | Astra-via',
  description: 'Explore Astra Workspace, Enigma, Evidence Validation, Astra Lab and Colossus: tools for document review, news intelligence, independent evidence review, research and AI engines.'
};

const approach = [
  { title: 'Start with a claim.', description: 'Bring the information and the questions that matter.' },
  { title: 'Examine the evidence.', description: 'Keep the source and its relationship to the claim in view.' },
  { title: 'Inspect the reasoning.', description: 'Understand the assessment and what still needs checking.' }
];

export default function Page() {
  return <div className="products-page">
    <a className="skip" href="#main-content">Skip to content</a>
    <SiteHeader active="products" />
    <main id="main-content" tabIndex={-1}>
      <section className="products-intro" aria-labelledby="products-title">
        <div className="products-intro-copy">
          <p className="eyebrow">Astra-via / Products</p>
          <h1 id="products-title">What we<br /><span>can do.</span></h1>
          <p className="products-lead">From information to a result<br className="products-desktop-break" /> you can inspect.</p>
          <p className="products-intro-description">Review documents, follow developing stories, gather independent perspectives and explore the methods behind an assessment. Find the Astra-via product that fits your next question.</p>
          <a className="products-primary-link" href="#products">Explore the products <span aria-hidden="true">↓</span></a>
        </div>
        <aside className="products-model" aria-labelledby="model-title">
          <p className="eyebrow" id="model-title">Our shared approach</p>
          <ol>{approach.map((step, index) => <li key={step.title}>
            <span className="products-step-number" aria-hidden="true">0{index + 1}</span>
            <div><h2>{step.title}</h2><p>{step.description}</p></div>
          </li>)}</ol>
          <p className="products-model-result">A result you can question.<span aria-hidden="true">↗</span></p>
        </aside>
      </section>

      <section id="products" className="product-catalog" aria-labelledby="catalog-title">
        <div className="products-section-heading">
          <div><p className="eyebrow">The product collection</p><h2 id="catalog-title">Find your starting point.</h2></div>
          <p className="products-count"><span>{String(products.length).padStart(2, '0')}</span> products / one shared approach</p>
        </div>
        <nav className="products-index" aria-label="Jump to a product">{products.map(product => <a key={product.id} href={'#' + product.id}>{product.name}<span aria-hidden="true">↘</span></a>)}</nav>
        <p className="products-access">Applications use Astra accounts. Access to some capabilities depends on your role or invitation.</p>
        <div className="product-grid">{products.map((product, index) => <article className={'product-card' + (index === 0 ? ' product-card-featured' : '')} id={product.id} key={product.id} aria-labelledby={product.id + '-title'}>
          <div className="product-card-top"><p className="product-category"><span aria-hidden="true">0{index + 1} / </span>{product.category}</p><span className="product-stage">{product.stage}</span></div>
          <div className="product-card-body">
            <div className="product-card-copy"><h3 id={product.id + '-title'}>{product.name}</h3><p className="product-headline">{product.headline}</p><p className="product-description">{product.description}</p></div>
            <ul className="product-features" aria-label={product.name + ' capabilities'}>{product.features.map(feature => <li key={feature}><span aria-hidden="true">↗</span>{feature}</li>)}</ul>
          </div>
          <div className="product-card-bottom"><p className="product-note">{product.note}</p><a className="product-open" href={product.href}>{product.action}<span aria-hidden="true">↗</span></a></div>
        </article>)}</div>
      </section>

      <section className="products-conversation" aria-labelledby="conversation-title">
        <div><p className="eyebrow">Start a conversation</p><h2 id="conversation-title">What are you<br />trying to understand?</h2><p>Tell us about your use case. We can help you find a starting point across the Astra-via products.</p></div>
        <a className="products-primary-link" href="mailto:support@astra-via.com?subject=Astra-via%20product%20enquiry">Talk to the team<span aria-hidden="true">↗</span></a>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
