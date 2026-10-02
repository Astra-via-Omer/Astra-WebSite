import { chapters } from '@/data/chapters';
import { SiteHeader, SiteFooter } from './SiteChrome';
export default function ReadingStory() {
  return <><SiteHeader active="journey" /><a className="skip" href="#main-content">Skip to content</a>
    <main id="main-content" tabIndex={-1} className="reading-page">
      <p className="eyebrow">The journey · Reading view</p>
      <h1>A result you can inspect.</h1>
      <p className="page-intro">The complete Astra-via story, without animated transitions.</p>
      <nav className="reading-index" aria-label="Story chapters">{chapters.map((chapter, i) => <a key={chapter.id} href={'#read-' + chapter.id}>{String(i + 1).padStart(2, '0')} · {chapter.label}</a>)}</nav>
      {chapters.map((chapter, i) => <section className="reading-chapter" id={'read-' + chapter.id} key={chapter.id}>
        <img src={'/story/' + chapter.image + '.webp'} alt="" loading="lazy" />
        <div><p className="eyebrow">{String(i + 1).padStart(2, '0')} / {chapter.label}</p><h2>{chapter.title.replace('\n', ' ')}</h2><p>{chapter.copy}</p><p>{chapter.detail}</p></div>
      </section>)}
      <aside className="notice">This website presents our approach and roadmap. Web3 provenance and decentralized storage are planned capabilities. AI-assisted assessments can be incomplete or incorrect and require human review. <a href="/legal">Read the disclaimer</a>.</aside>
    </main><SiteFooter /></>;
}
