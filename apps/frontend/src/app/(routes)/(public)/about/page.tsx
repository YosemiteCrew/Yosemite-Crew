import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import { About } from '@/app/features/marketing/pages/About/About';

export const metadata: Metadata = {
  title: 'About · Yosemite Crew',
  description:
    'We build the boring layer underneath, where the vet, the nurse, the lab and the next clinic all see the same animal at the same moment, while there is still time.',
};

export default function Page() {
  return (
    <MarketingShell active="about">
      <About />
    </MarketingShell>
  );
}
