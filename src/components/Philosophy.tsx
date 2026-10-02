'use client';
import { useEffect, useRef, useState } from 'react';
import { philosophers } from '@/data/philosophers';
import { SiteHeader, SiteFooter, useMotion } from './SiteChrome';

export default function Philosophy() {
  const { quiet } = useMotion();
  const [active, setActive] = useState(0);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const images = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
    }, { rootMargin: '-20% 0px -55% 0px' });
    sections.current.forEach(section => section && observer.observe(section));
    let frame = 0, current = scrollY;
    const render = () => {
      current += (scrollY - current) * .035;
      images.current.forEach((image, i) => {
        const section = sections.current[i];
        if (!image || !section) return;
        const distance = Math.max(-1, Math.min(1, (current - section.offsetTop) / innerHeight));
        image.style.transform = quiet ? 'none' : `perspective(1400px) translate3d(${distance * -16}px,${distance * -22}px,0) rotateY(${distance * 2}deg) scale(${1.02 + Math.abs(distance) * .025})`;
      });
      if (!quiet) frame = requestAnimationFrame(render);
    };
    render();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [quiet]);
  return <div className={'philosophy-page' + (quiet ? ' quiet-philosophy' : '')}>
    <a className="skip" href="#main-content">Skip to content</a><SiteHeader active="philosophy" />
    <div className="philosophy-world" aria-hidden="true">{philosophers.map((person, i) => <div key={person.id} ref={el => { images.current[i] = el; }} className={'philosophy-art' + (active === i ? ' visible' : '')}><img src={'/philosophy/' + person.image + '.webp'} alt="" fetchPriority={i === 0 ? 'high' : 'auto'} /></div>)}<div className="philosophy-shade" /></div>
    <main id="main-content" tabIndex={-1}>
      {philosophers.map((person, i) => <section key={person.id} id={person.id} data-index={i} ref={el => { sections.current[i] = el; }} className="philosopher-section" aria-labelledby={person.id + '-title'}>
        <div className="philosopher-copy">
          <p className="eyebrow">Philosophy / {String(i + 1).padStart(2, '0')}</p>
          {i === 0 ? <h1 id={person.id + '-title'}>{person.title}</h1> : <h2 id={person.id + '-title'}>{person.title}</h2>}
          <p className="philosopher-name">{person.name} <span>{person.years}</span></p><p className="philosopher-lens">{person.lens}</p>
          {person.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          <aside className="astra-connection">{i === 0 ? <h2 className="connection-heading">Our Astra connection</h2> : <h3>Our Astra connection</h3>}<p>{person.connection}</p></aside>
          <nav className="philosopher-sources" aria-label={person.name + ' sources'}>{person.sources.map(source => <a key={source.href} href={source.href} rel="noreferrer">{source.label} ↗</a>)}</nav>
        </div>
      </section>)}
      <aside className="philosophy-note"><h2>Four lenses. An open inquiry.</h2><p>These thinkers disagree on significant questions. This page offers brief editorial interpretations and connects selected ideas to our approach. It does not claim endorsement, a shared doctrine or a historical connection to Astra-via. Portraits are AI-generated artistic interpretations.</p><a href="/story">Explore our approach ↗</a></aside>
    </main>
    <nav className="philosophy-chapters" aria-label="Philosophers">{philosophers.map((person, i) => <a key={person.id} href={'#' + person.id} aria-current={active === i ? 'location' : undefined}><span>{String(i + 1).padStart(2, '0')}</span>{person.name}</a>)}</nav>
    <SiteFooter />
  </div>;
}
