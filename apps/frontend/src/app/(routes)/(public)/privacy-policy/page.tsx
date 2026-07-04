import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import PrivacyPolicy from '@/app/features/legal/pages/PrivacyPolicy';
import BackToSignup from '@/app/features/legal/components/BackToSignup';

export const metadata: Metadata = {
  title: 'Privacy policy · Yosemite Crew',
  description:
    'How our open-source practice management software collects, processes and stores personal data, as a web app and a mobile app.',
};

export default function Page() {
  return (
    <MarketingShell>
      <Suspense fallback={null}>
        <BackToSignup />
      </Suspense>
      <PrivacyPolicy />
    </MarketingShell>
  );
}
