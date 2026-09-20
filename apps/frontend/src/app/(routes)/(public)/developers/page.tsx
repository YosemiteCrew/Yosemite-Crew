import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import { DevelopersPage } from '@/app/features/marketing/pages/DevelopersPage/DevelopersPage';

// no-story: thin Next.js route wrapper; real content is DevelopersPage, already storied
export const metadata: Metadata = {
  title: 'Developers · Yosemite Crew',
  description:
    'Explore the open-source codebase and the authenticated, read-only Yosemite Crew developer API.',
};

export default function Page() {
  return (
    <MarketingShell active="developers">
      <DevelopersPage />
    </MarketingShell>
  );
}
