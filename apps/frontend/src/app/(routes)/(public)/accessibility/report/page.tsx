import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import AccessibilityReportClient from './AccessibilityReportClient';

export const metadata: Metadata = {
  title: 'Report an Accessibility Issue | Yosemite Crew',
  description:
    'Report an accessibility barrier or usability issue so the Yosemite Crew team can review it.',
};

export default function AccessibilityReportPage() {
  return (
    <MarketingShell>
      <AccessibilityReportClient />
    </MarketingShell>
  );
}
