import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import TermsAndConditions from '@/app/features/legal/pages/TermsAndConditions';
import BackToSignup from '@/app/features/legal/components/BackToSignup';

export const metadata: Metadata = {
  title: 'Terms and conditions · Yosemite Crew',
  description:
    'The Yosemite Crew License and Subscription Terms (SaaS). These govern the hosted service. The self-hosting Software is governed only by its open-source licence.',
};

export default function Page() {
  return (
    <MarketingShell>
      <Suspense fallback={null}>
        <BackToSignup />
      </Suspense>
      <TermsAndConditions />
    </MarketingShell>
  );
}
