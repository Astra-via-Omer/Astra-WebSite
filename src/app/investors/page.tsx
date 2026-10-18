import type { Metadata } from 'next';
import InvestorRoom from '@/components/InvestorRoom';
import { publicConfig } from '@/investors/server';
import './room.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Investor Room | Astra-via', description: 'Private investor access to Astra-via documents and investor relations.', robots: { index: false, follow: false, nocache: true } };
export default function InvestorsPage() { return <InvestorRoom config={publicConfig()} />; }
