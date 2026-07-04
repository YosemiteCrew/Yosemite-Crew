import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import AccessibilityStatement from '@/app/features/legal/pages/AccessibilityStatement';

export const metadata: Metadata = {
  title: 'Accessibility Statement · Yosemite Crew',
  description:
    'Yosemite Crew is committed to making its digital services accessible to everyone. Our conformance status, measures and how to report a barrier. Target: WCAG 2.2 Level AA.',
};

export default function Page() {
  return (
    <MarketingShell>
      <AccessibilityStatement />
    </MarketingShell>
  );
}
