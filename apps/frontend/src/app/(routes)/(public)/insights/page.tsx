import React from 'react';
import OverviewPage from '@/app/features/overview/pages/OverviewPage';
import { MarketingShell } from '@/app/features/marketing/site';

export const metadata = {
  title: 'Insights | Yosemite Crew',
  description: 'Project health, code quality, and community statistics for Yosemite Crew.',
};

export default function Page() {
  return (
    <MarketingShell hideFooter>
      <OverviewPage />
    </MarketingShell>
  );
}
