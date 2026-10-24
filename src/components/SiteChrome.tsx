'use client';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState } from 'react';

const MotionContext = createContext({ quiet: false, toggle: () => {} });
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.motion = quiet ? 'reduced' : 'full';
  }, [quiet]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce), (max-height: 600px)');
    const update = () => setQuiet(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <MotionContext.Provider value={{ quiet, toggle: () => setQuiet(value => !value) }}>{children}</MotionContext.Provider>;
}
export const useMotion = () => useContext(MotionContext);
export function SiteHeader({ active }: { active?: 'journey' | 'philosophy' | 'products' | 'team' | 'demo' | 'investors' }) {
  const { quiet, toggle } = useMotion();
  return <header className="site-header">
    <Link href="/" aria-label="Astra-via home"><img src="/astra-logo.svg" alt="Astra-via" width="150" height="36" /></Link>
    <nav aria-label="Main navigation">
      <Link href="/" aria-current={active === 'journey' ? 'page' : undefined}>The journey</Link>
      <Link href="/philosophy" aria-current={active === 'philosophy' ? 'page' : undefined}>Philosophy</Link>
      <Link href="/what-we-can-do" aria-current={active === 'products' ? 'page' : undefined}>What we can do</Link>
      <Link href="/team" aria-current={active === 'team' ? 'page' : undefined}>Our team</Link>
      <Link href="/investors" aria-current={active === 'investors' ? 'page' : undefined}>Investor Room</Link>
      <Link className="demo-nav" href="/register">Create free account ↗</Link>
    </nav>
    <button onClick={toggle} aria-pressed={quiet}>Reduce motion <span aria-hidden="true">{quiet ? '✓' : '○'}</span></button>
  </header>;
}
export function SiteFooter({ floating = false }: { floating?: boolean }) {
  return <footer className={'site-footer' + (floating ? ' floating-footer' : '')}>
    <span>© {new Date().getFullYear()} Astra-via</span>
    <nav aria-label="Information and legal">
      <Link href="/story">Reading view</Link>
      <Link href="/what-we-can-do">What we can do</Link>
      <Link href="/privacy">Product privacy</Link><Link href="/subprocessors">Service providers</Link>
      <Link href="/legal">Terms & disclaimer</Link>
      <Link href="/accessibility">Accessibility</Link>
    </nav>
  </footer>;
}
