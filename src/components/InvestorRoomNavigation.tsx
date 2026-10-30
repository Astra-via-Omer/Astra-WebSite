'use client';

import Link from 'next/link';

export function InvestorRoomHeader() {
  return <header className="ir-room-header"><Link href="/" aria-label="Astra-via home"><img src="/astra-logo.svg" alt="Astra-via" width="150" height="36" /></Link><span>Investor Room</span><nav aria-label="Investor room help"><a href="mailto:support@astra-via.com">Help</a><Link href="/">Astra website <span aria-hidden="true">↗</span></Link></nav></header>;
}

export default function InvestorRoomNavigation({ selected, admin, onSelect }: { selected: string; admin: boolean; onSelect: (tab: string) => void }) {
  const sections = [['overview', 'Overview'], ['documents', 'Documents'], ['updates', 'Astra updates'], ['questions', 'Questions'], ['account', 'Your account'], ...(admin ? [['admin', 'Manage room']] : [])];
  return <nav className="ir-room-navigation" id="ir-sections" aria-label="Investor room sections">
    <div className="ir-tabs">{sections.map(([key, label]) => <button key={key} type="button" aria-current={selected === key ? 'page' : undefined} onClick={() => onSelect(key)}>{label}</button>)}</div>
    <label className="ir-mobile-navigation">Go to<select value={selected} onChange={event => onSelect(event.target.value)}>{sections.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
  </nav>;
}
