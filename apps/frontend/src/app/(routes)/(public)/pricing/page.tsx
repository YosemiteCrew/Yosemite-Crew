import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import { Pricing } from '@/app/features/marketing/pages/Pricing/Pricing';

export const metadata: Metadata = {
  title: 'Pricing · Yosemite Crew',
  description:
    'Run it yourself for nothing, or let us host it and pay only for what you use. No long contracts, no cut of your payments, and under AGPL-3.0 you own the software.',
};

export default function Page() {
  return (
    <MarketingShell active="pricing">
      <Pricing />
    </MarketingShell>
  );
}
