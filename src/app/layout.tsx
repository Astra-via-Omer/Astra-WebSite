import type { Metadata } from 'next';
import './globals.css';
import './region/region.css';
import { MotionProvider } from '@/components/SiteChrome';
import { PrivacyProvider } from '@/components/PrivacyControls';
import { tagManagerId } from '@/regional/consent';
import { headers } from 'next/headers';
export const metadata: Metadata = {
  title: 'Astra-Via | Web3 Result as a Service',
  description: 'Astra-Via is pioneering Web3 RaaS — Result as a Service for the AI era. Explore inspectable results built from claims, evidence and reasoning, starting with document review.',
  icons: { icon: '/astra-icon.svg' },
};
export const dynamic = 'force-dynamic';
export default async function Layout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const containerId = process.env.ASTRA_GTM_ENABLED === 'true' ? tagManagerId(process.env.ASTRA_GTM_CONTAINER_ID) : null;
  return <html lang="en"><body><MotionProvider><PrivacyProvider containerId={containerId} serverPrivacySignal={requestHeaders.get('sec-gpc') === '1' || requestHeaders.get('dnt') === '1'}>{children}</PrivacyProvider></MotionProvider></body></html>;
}
