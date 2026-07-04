import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import DmcaCopyrightPolicy from '@/app/features/legal/pages/DmcaCopyrightPolicy';

export const metadata: Metadata = {
  title: 'DMCA Copyright Policy · Yosemite Crew',
  description:
    'Yosemite Crew respects intellectual property. How we handle copyright claims and how rights holders and users can reach our copyright agent.',
};

export default function Page() {
  return (
    <MarketingShell>
      <DmcaCopyrightPolicy />
    </MarketingShell>
  );
}
