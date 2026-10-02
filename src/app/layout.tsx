import type { Metadata } from 'next';
import './globals.css';
import { MotionProvider } from '@/components/SiteChrome';
export const metadata: Metadata = {
  title: 'Astra-Via | Web3 Result as a Service',
  description: 'Astra-Via is pioneering Web3 RaaS — Result as a Service for the AI era. Explore inspectable results built from claims, evidence and reasoning, starting with document review.',
  icons: { icon: '/astra-icon.svg' },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><MotionProvider>{children}</MotionProvider></body></html>;
}
