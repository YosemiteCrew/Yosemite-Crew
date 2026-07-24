import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import { Home } from '@/app/features/marketing/pages/Home/Home';

export const metadata: Metadata = {
  title: 'See the whole animal · Yosemite Crew',
  description:
    'Yosemite Crew is the open-source operating system for animal health that puts the whole story on one screen: for the clinic, the pet parent, and whoever cares for them next.',
};

export default function Page() {
  return (
    <MarketingShell>
      <Home />
    </MarketingShell>
  );
}
