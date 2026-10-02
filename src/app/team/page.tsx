import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

export const metadata = {
  title: 'Our team | Astra-via',
  description: 'Meet Omer Aviad and Yovav Kalifon, part of the team building Astra-via and its approach to inspectable results.'
};

const team = [
  { name: 'Omer Aviad', initials: 'OA' },
  { name: 'Yovav Kalifon', initials: 'YK' }
];

export default function Page() {
  return <div className="team-page">
    <a className="skip" href="#main-content">Skip to content</a>
    <SiteHeader active="team" />
    <main id="main-content" tabIndex={-1}>
      <section className="team-intro" aria-labelledby="team-title">
        <div>
          <p className="eyebrow">Astra-via / Our team</p>
          <h1 id="team-title">The people<br />behind the path.</h1>
          <p className="page-intro">We’re building Astra-via around a simple idea: a result should come with a path you can inspect.</p>
          <p className="team-summary">From claims to evidence to reasoning, our work brings the steps behind an assessment into view. Meet Omer Aviad and Yovav Kalifon.</p>
          <a className="team-explore" href="#people">Meet the team <span aria-hidden="true">↓</span></a>
        </div>
        <div className="team-orbit" aria-hidden="true"><div className="orbit-core">A</div><i /><i /><i /><span className="orbit-label orbit-claim">Claim</span><span className="orbit-label orbit-evidence">Evidence</span><span className="orbit-label orbit-reasoning">Reasoning</span></div>
      </section>
      <section id="people" className="team-people" aria-labelledby="people-title">
        <div className="team-section-heading"><p className="eyebrow">The people</p><h2 id="people-title">Building Astra-via.</h2></div>
        <div className="team-grid">{team.map((person, i) => <article key={person.name} className="team-card" aria-labelledby={'person-' + i}>
          <span className="team-card-number" aria-hidden="true">0{i + 1}</span>
          <div className="team-monogram" aria-hidden="true"><span>{person.initials}</span><i /><i /></div>
          <p className="eyebrow">Astra-via / Team</p>
          <h3 id={'person-' + i}>{person.name}</h3>
        </article>)}</div>
      </section>
      <section className="team-approach" aria-labelledby="approach-title">
        <p className="eyebrow">What brings us together</p>
        <h2 id="approach-title">Make the reasoning visible.<br />Keep the questions open.</h2>
        <p>Our Result as a Service approach starts with document review: connecting claims to their sources, explaining the reasoning and showing what still needs validation. Our Web3 roadmap explores how provenance and portable results can extend that path.</p>
        <div className="team-links"><Link href="/story">Explore our approach ↗</Link><Link href="/philosophy">Explore our philosophy ↗</Link></div>
      </section>
      <section className="team-contact" aria-labelledby="contact-title">
        <div><p className="eyebrow">Start a conversation</p><h2 id="contact-title">Connect with the team.</h2><p>Reach us through our shared support inbox.</p></div>
        <div><a className="team-email" href="mailto:support@astra-via.com">support@astra-via.com <span aria-hidden="true">↗</span></a><p className="team-contact-note">We’ll use the details you send to respond. Please avoid sending confidential or sensitive documents. <Link href="/privacy">Privacy & cookies</Link></p></div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
