import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

export const metadata = {
  title: 'Our team | Astra-via',
  description: 'Meet Omer Aviad, Yovav Kalifon and Michael Longmuir, part of the team building Astra-via and its approach to inspectable results.'
};

const team: { name: string; initials: string; biography?: string[]; email?: string }[] = [
  {
    name: 'Omer Aviad', initials: 'OA', email: 'omer@astra-via.com',
    biography: [
      'Omer is a technology leader with more than 25 years of experience in software engineering, system architecture and advanced technology development. He specializes in translating complex ideas into practical systems that deliver real-world value.',
      'He has held senior architecture and technology leadership roles at global technology companies including NICE (NASDAQ: NICE), Nova Measuring Instruments (NASDAQ: NVMI) and Nanox (NASDAQ: NNOX).',
      'Omer has led the design and development of complex software platforms used by customers and organizations worldwide. His experience spans defense technologies, homeland security systems, medical platforms, semiconductor manufacturing systems and large-scale cloud infrastructure.'
    ]
  },
  {
    name: 'Yovav Kalifon', initials: 'YK', email: 'yovav@astra-via.com',
    biography: [
      'Yovav is a research scientist with a background in physics, semiconductor metrology and technology collaboration. His experience at Nova Ltd. spans work within the CTO group, research and development partnerships, academic relations and public funding.',
      'He connects industry and academia through collaborative research and funding initiatives in the semiconductor and metrology sectors. His technical work includes materials metrology for advanced semiconductor devices, a topic he has presented at industry conferences.',
      'Yovav studied at the Weizmann Institute of Science and completed the Mini-MBA for Engineers and Technology Managers at Rutgers Business School.'
    ]
  },
  {
    name: 'Michael Longmuir', initials: 'ML', email: 'Michael@astra-via.com',
    biography: [
      'Michael has spent 4 decades in business, investment and advisory work across the US, UK, Canada, the Middle East, Africa and Asia. He has worked in banking, M&A, manufacturing, telecommunications, technology, healthcare and education, led corporate turnarounds, run 6 businesses and advised on numerous transactions. He has also served as an adviser to a finance minister.',
      'Now based in London, Michael works with a small number of clients internationally, alongside his private investment activities.'
    ]
  }
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
          <p className="team-summary">From claims to evidence to reasoning, our work brings the steps behind an assessment into view. Meet Omer Aviad, Yovav Kalifon and Michael Longmuir.</p>
          <a className="team-explore" href="#people">Meet the team <span aria-hidden="true">↓</span></a>
        </div>
        <div className="team-orbit" aria-hidden="true"><div className="orbit-core">A</div><i /><i /><i /><span className="orbit-label orbit-claim">Claim</span><span className="orbit-label orbit-evidence">Evidence</span><span className="orbit-label orbit-reasoning">Reasoning</span></div>
      </section>
      <section id="people" className="team-people" aria-labelledby="people-title">
        <div className="team-section-heading"><p className="eyebrow">The people</p><h2 id="people-title">Building Astra-via.</h2></div>
        <div className="team-grid">{team.map((person, i) => <article id={person.name.toLowerCase().replaceAll(' ', '-')} key={person.name} className={'team-card' + (person.biography ? ' team-card-bio' : '')} aria-labelledby={'person-' + i}>
          <span className="team-card-number" aria-hidden="true">0{i + 1}</span>
          <div className="team-monogram" aria-hidden="true"><span>{person.initials}</span><i /><i /></div>
          <div className="team-profile"><p className="eyebrow">Astra-via / Team</p>
          <h3 id={'person-' + i}>{person.name}</h3>
          {person.biography?.map(paragraph => <p className="team-biography" key={paragraph}>{paragraph}</p>)}
          {person.email && <a className="team-email" href={'mailto:' + person.email}>{person.email} <span aria-hidden="true">↗</span></a>}</div>
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
