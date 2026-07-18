import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import { Insights } from '@/app/features/marketing/pages/Insights/Insights';

export const metadata: Metadata = {
  title: 'Insights · Yosemite Crew',
  description:
    'Building in public. Live project health, community and repository numbers for Yosemite Crew, pulled straight from GitHub.',
};

export default function Page() {
  return (
    <MarketingShell>
      <Insights />
    </MarketingShell>
  );
}
