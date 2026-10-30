'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { investorInitials } from '@/investors/presentation';
import { philosophers } from '@/data/philosophers';
import InvestorProgressTimeline from './InvestorProgressTimeline';
import type { InvestorProgress } from '@/investors/dispatch';

export type InvestorDocument = { id: string; title: string; category: string; version: string; description: string; pages: number; published: boolean; can_download?: boolean; created_at?: string };
export type InvestorPerson = { user_id: string; email: string; role: string; organization: string; expires_at: string | null; tab_access?: string[]; stage: string; approved?: boolean; display_name?: string };

const point = (radius: number, angle: number) => {
  const depth = 142 / (1 + (radius / .23) ** 2);
  return [300 + Math.cos(angle) * radius * 265, 156 + Math.sin(angle) * radius * 102 + depth];
};
const path = (points: number[][]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
const rings = Array.from({ length: 24 }, (_, i) => path(Array.from({ length: 97 }, (_, j) => point(.045 + i / 23 * .955, j / 96 * Math.PI * 2))));
const spokes = Array.from({ length: 40 }, (_, i) => path(Array.from({ length: 55 }, (_, j) => point(.035 + j / 54 * .965, i / 40 * Math.PI * 2))));

export function GravityField() {
  const id = useId().replaceAll(':', '');
  return <figure className="ir-gravity" aria-label="A gravity well, representing the connections between claims, evidence and reasoning">
    <div className="ir-figure-label"><span>FIG. 01 / THE GRAVITY WELL</span><span aria-hidden="true">[ x, y, ∞ ]</span></div>
    <svg viewBox="0 0 600 380" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-glow`}><stop stopColor="#2be8f5" stopOpacity=".25" /><stop offset="1" stopColor="#2be8f5" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-mesh`} x1="300" y1="75" x2="300" y2="320" gradientUnits="userSpaceOnUse"><stop stopColor="#8cd9ec" stopOpacity=".16" /><stop offset=".6" stopColor="#58cddb" stopOpacity=".55" /><stop offset="1" stopColor="#a4f1f5" stopOpacity=".9" /></linearGradient>
      </defs>
      <ellipse cx="300" cy="244" rx="220" ry="125" fill={`url(#${id}-glow)`} className="ir-well-glow" />
      <g stroke={`url(#${id}-mesh)`} strokeWidth=".65">{rings.map((d, i) => <path d={d} key={`r${i}`} />)}{spokes.map((d, i) => <path d={d} key={`s${i}`} />)}</g>
      <ellipse cx="300" cy="156" rx="279" ry="108" stroke="#8cd9ec" strokeOpacity=".12" strokeDasharray="2 7" />
      <path d="M300 40V105M300 310V343M17 156H47M553 156H583" stroke="#8cd9ec" strokeOpacity=".4" />
      <circle cx="300" cy="296" r="5" fill="#e4fdff" /><circle cx="300" cy="296" r="13" stroke="#a4f1f5" strokeOpacity=".5" className="ir-core-ring" />
      {[[113, 123], [457, 98], [501, 214], [198, 229]].map(([x, y], i) => <g key={x}><circle cx={x} cy={y} r="3" fill={i === 1 ? '#f5f9ff' : '#a4f1f5'} /><circle cx={x} cy={y} r="8" stroke="#a4f1f5" strokeOpacity=".22" /></g>)}
      <g stroke="#85b4c5" strokeOpacity=".3"><path d="M113 123L79 90H36M457 98L492 57H551M501 214L540 245H574" /></g>
      <g fill="#9db7c9" fontSize="8" fontFamily="monospace" letterSpacing="1.4"><text x="35" y="80">CLAIM</text><text x="501" y="47">SOURCE</text><text x="524" y="262">REASONING</text></g>
    </svg>
    <figcaption><span>Connections give the picture depth.</span><span aria-hidden="true">ƒ ( evidence )</span></figcaption>
  </figure>;
}

export function Fingerprint({ small = false }: { small?: boolean }) {
  return <svg className={`ir-fingerprint${small ? ' ir-fingerprint-small' : ''}`} viewBox="0 0 160 170" fill="none" aria-hidden="true">
    {Array.from({ length: 10 }, (_, i) => {
      const r = 11 + i * 5.6;
      return <path key={i} d={`M${80 - r} ${119 + i * 2}V${77 + i * .2}a${r} ${r * .92} 0 0 1 ${r * 2} 0v${22 - i}q0 ${31 + i * 2} ${-15 - i * 3} ${49 - i}`} stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity={.98 - i * .065} />;
    })}
    <path d="M80 76v37q0 29-12 42" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>;
}

export function RoomWelcome({ member, signedIn }: { member?: InvestorPerson; signedIn: boolean }) {
  const name = member?.display_name || member?.email.split('@')[0];
  if (signedIn) return <section className="ir-return-welcome" aria-labelledby="ir-welcome-title"><p className="ir-code-label">ASTRA-VIA / INVESTOR ROOM</p><h1 id="ir-welcome-title">{name ? <>Welcome back, <em>{name}.</em></> : 'Your investor room.'}</h1><p>Your documents, company updates, and a direct line to the Astra team.</p></section>;
  return <>
    <div className="ir-room-coordinate"><span><i /> ASTRA-VIA <b>/</b> INVESTOR RELATIONS</span><span>{member ? 'YOUR PRIVATE ORBIT' : 'A CLOSER PERSPECTIVE'} <b aria-hidden="true">↗</b></span></div>
    <section className="ir-observatory" aria-labelledby="ir-welcome-title">
      <div className="ir-hero-copy">
        <p className="ir-code-label"><span aria-hidden="true">{'< '}</span>{member ? 'A PLACE FOR YOUR PERSPECTIVE' : 'IDEAS WORTH LOOKING INTO'}<span aria-hidden="true">{' />'}</span></p>
        <h1 id="ir-welcome-title">{member ? <>Welcome,<br /><em>{name}.</em></> : <>A closer orbit.<br /><em>A clearer view.</em></>}</h1>
        <p className="ir-hero-description">{member ? 'Your perspective is part of what comes next. Explore the work, follow the thinking, and help shape the conversation.' : 'Extraordinary ideas deserve a closer look. Step into the thinking, the evidence, and the possibilities behind Astra-Via.'}</p>
        <a className="ir-text-link" href={signedIn ? '#ir-your-space' : '#ir-enter'}>{signedIn ? 'Explore your space' : 'Enter the investor room'} <span aria-hidden="true">↗</span></a>
      </div>
      <GravityField />
    </section>
    <div className="ir-principle-line"><span>START WITH A QUESTION</span><i aria-hidden="true" /><span>FOLLOW THE EVIDENCE</span><i aria-hidden="true" /><span>MAKE THE REASONING VISIBLE</span><b aria-hidden="true">{'{ }'}</b></div>
  </>;
}

export function InvestorIdentity({ member, onAccount, onSignOut }: { member?: InvestorPerson; onAccount?: () => void; onSignOut: () => void }) {
  return <div className="ir-identity-bar" id="ir-your-space">
    <div className="ir-identity-person"><span className="ir-avatar" aria-hidden="true">{member ? investorInitials(member.display_name || member.email) : '…'}</span><div><strong>{member?.display_name || 'Opening your space…'}</strong><span>{member?.organization ? `${member.organization} · ` : ''}{member?.email || 'Checking your individual access'}</span></div></div>
    <div className="ir-identity-actions">{member && <span className="ir-recognized"><i /> ACCOUNT RECOGNIZED</span>}{onAccount && <button onClick={onAccount} aria-label="Open your account">Your account <span aria-hidden="true">↗</span></button>}<button className="ir-signout" onClick={onSignOut}>Sign out</button></div>
  </div>;
}

export function LoginIntroduction() {
  return <section className="ir-entry-introduction"><p className="ir-code-label">01 / YOUR WAY IN</p><h2>Every connection<br />starts with <em>you.</em></h2><p>A private space for the people looking deeper. Your documents, your conversations, and a direct line to the Astra team.</p><ol className="ir-entry-steps"><li><span>01</span><div><strong>Make yourself known.</strong><p>Sign in with your invited account.</p></div></li><li><span>02</span><div><strong>A shared understanding.</strong><p>Read the confidentiality agreement before exploring.</p></div></li><li><span>03</span><div><strong>Follow your curiosity.</strong><p>Explore your materials and bring us your questions.</p></div></li></ol><div className="ir-entry-signature"><Fingerprint small /><p>A personal space.<br /><span>Every document copy carries your own trace.</span></p></div></section>;
}

export function InvestorOverview({ member, documents, onTab, onOpen, progress, tabs = ['overview', 'documents', 'updates', 'questions', 'account'] }: { tabs?: string[]; progress?: InvestorProgress | null; member: InvestorPerson; documents: InvestorDocument[]; onTab: (tab: string) => void; onOpen: (doc: InvestorDocument) => void }) {
  const latest = documents[0];
  return <div className="ir-overview">
    <div className="ir-section-title"><div><p className="ir-code-label">01 / YOUR PRIVATE VIEW</p><h2>A little closer to <em>what’s next.</em></h2></div><span className="ir-material-count">{String(documents.length).padStart(2, '0')} <span>materials shared with you</span></span></div>
    <div className="ir-overview-grid"><section className="ir-briefing"><div className="ir-card-top"><span className="ir-code-label">YOUR BRIEFING</span><span aria-hidden="true">{'[ 01 ]'}</span></div><div className="ir-briefing-content"><span className="ir-tiny-orbit" aria-hidden="true">✳</span><p className="ir-code-label">{latest ? latest.category : 'THE NEXT CHAPTER'}</p><h3>{latest ? latest.title : 'Good things begin\nwith a conversation.'}</h3><p>{latest ? latest.description || `Version ${latest.version} · ${latest.pages} pages. Your personalized copy is ready to explore.` : 'Your approved materials will find their home here. In the meantime, get to know the thinking behind Astra, or start a conversation with us.'}</p></div><div className="ir-card-bottom"><span>{latest ? `VERSION ${latest.version}` : 'YOUR PERSPECTIVE IS WELCOME'}</span>{(latest || tabs.includes('questions')) && <button className="ir-text-button" onClick={() => latest ? onOpen(latest) : onTab('questions')}>{latest ? 'Open your briefing' : 'Ask the Astra team'} <span aria-hidden="true">↗</span></button>}</div></section>
      <section className="ir-signature-card"><div className="ir-card-top"><span className="ir-code-label">A PERSONAL CONNECTION</span><span aria-hidden="true">{'{ you }'}</span></div><Fingerprint /><h3>{member.display_name || member.email.split('@')[0]}</h3><p>Your perspective is unique.<br />Your document copies are personal.</p><div className="ir-signature-rule"><span>EMAIL + TIME + COPY ID</span><button className="ir-text-button" onClick={() => onTab('account')}>Your account <span aria-hidden="true">↗</span></button></div></section></div>
    {tabs.includes('updates') && <InvestorDispatch documents={documents} progress={progress} onOpen={onOpen} compact onAll={() => onTab('updates')} />}
  </div>;
}

export function InvestorDispatch({ documents, onOpen, progress, compact = false, onAll }: { documents: InvestorDocument[]; progress?: InvestorProgress | null; onOpen: (doc: InvestorDocument) => void; compact?: boolean; onAll?: () => void }) {
  const updates = documents.filter(doc => doc.category === 'Investor updates');
  return <section className="ir-dispatch">
    <div className="ir-section-title"><div><p className="ir-code-label">02 / THE ASTRA DISPATCH</p><h2>From inside <em>the work.</em></h2></div>{onAll && <button className="ir-text-button" onClick={onAll}>All updates <span aria-hidden="true">↗</span></button>}</div>
    {progress && progress.entries.length > 0 && <InvestorProgressTimeline progress={progress} compact={compact} />}
    {updates.length > 0 && <><h3 className="ir-dispatch-documents-title">Investor briefings</h3><div className="ir-dispatch-grid">{updates.slice(0, compact ? 3 : undefined).map((doc, i) => <article key={doc.id}><div className="ir-card-top"><span className="ir-code-label">INVESTOR UPDATE</span><span>{String(i + 1).padStart(2, '0')}</span></div><h3>{doc.title}</h3><p>{doc.description}</p><div className="ir-card-bottom"><span>{doc.created_at ? `ADDED ${new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : `VERSION ${doc.version}`}</span><button className="ir-text-button" onClick={() => onOpen(doc)}>Read update <span aria-hidden="true">↗</span></button></div></article>)}</div></>}
    {!updates.length && !progress?.entries.length && <div className="ir-dispatch-empty"><span aria-hidden="true">{'[ ··· ]'}</span><div><h3>A space for the next dispatch.</h3><p>Company news and investor updates will appear here when the team releases them to your account.</p></div><span className="ir-code-label">STAY CURIOUS.</span></div>}
  </section>;
}

const methods = [
  { name: 'The gravity well', code: '01 / CONNECTION', title: 'See what pulls\nthe picture together.', text: 'A claim has context. The Gravity Well brings claims, sources and reasoning into a connected view, making evidence gaps easier to explore.', label: 'Explore the Astra approach', href: '/story#reasoning' },
  { name: 'The fingerprint', code: '02 / TRACEABILITY', title: 'Every result\nleaves a trace.', text: 'Start with the original source. Follow the quotation, its context, and the reasoning behind the result. In this room, each delivered PDF also carries your email, the time and a unique copy ID.', label: 'Follow the source', href: '/story#source' },
  { name: 'The philosophy', code: '03 / PERSPECTIVE', title: 'Good questions\nmove us forward.', text: 'Reality, questioning, logic and the willingness to revise. These ideas guide the way Astra approaches evidence, and the conversations we want to have with you.', label: 'Meet the ideas behind Astra', href: '/philosophy' },
];

export function AstraMethod() {
  const [selected, setSelected] = useState(0);
  const method = methods[selected];
  return <section className="ir-method" id="ir-astra-method" aria-labelledby="ir-method-title"><div className="ir-section-title"><div><p className="ir-code-label">THE THINKING BENEATH THE SURFACE</p><h2 id="ir-method-title">A way of looking.<br /><em>A reason to look closer.</em></h2></div><span className="ir-method-bracket" aria-hidden="true">{'{↗}'}</span></div>
    <div className="ir-method-tabs" role="tablist" aria-label="Explore the Astra method">{methods.map((item, i) => <button key={item.name} id={`ir-method-tab-${i}`} role="tab" aria-selected={selected === i} aria-controls="ir-method-panel" tabIndex={selected === i ? 0 : -1} onClick={() => setSelected(i)} onKeyDown={event => { let next = i; if (event.key === 'ArrowRight') next = (i + 1) % methods.length; else if (event.key === 'ArrowLeft') next = (i + methods.length - 1) % methods.length; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = methods.length - 1; else return; event.preventDefault(); setSelected(next); document.getElementById(`ir-method-tab-${next}`)?.focus(); }}><span>0{i + 1}</span>{item.name}<b aria-hidden="true">↗</b></button>)}</div>
    <div className="ir-method-panel" id="ir-method-panel" role="tabpanel" aria-labelledby={`ir-method-tab-${selected}`} tabIndex={0}><div className={`ir-method-art ir-method-art-${selected}`} aria-hidden="true">{selected === 0 ? <div className="ir-method-orbits"><i /><i /><i /><span>●</span></div> : selected === 1 ? <Fingerprint /> : <span className="ir-philosophy-mark">?</span>}<span className="ir-art-coordinate">ASTRA / {String(selected + 1).padStart(2, '0')}</span></div><div><p className="ir-code-label">{method.code}</p><h3>{method.title}</h3><p>{method.text}</p><Link className="ir-text-link" href={method.href}>{method.label} <span aria-hidden="true">↗</span></Link></div></div>
    <div className="ir-philosopher-line" aria-label="The philosophical influences behind Astra">{philosophers.map((person, i) => <Link key={person.id} href={`/philosophy#${person.id}`}><span>0{i + 1} / {['REALITY', 'QUESTION', 'REASON', 'REVISE'][i]}</span><strong>{person.name}</strong><small>{person.title}</small></Link>)}</div>
    <p className="ir-closing-thought">The future starts with a better question.<span>Thank you for being part of ours.</span></p>
  </section>;
}
