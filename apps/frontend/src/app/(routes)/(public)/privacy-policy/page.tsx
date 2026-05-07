import React, { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Yosemite Crew',
  description: 'Read how Yosemite Crew handles your personal data and privacy.',
};
import PrivacyPolicy from '@/app/features/legal/pages/PrivacyPolicy';
import BackToSignup from '@/app/features/legal/components/BackToSignup';

function page() {
  return (
    <>
      <Suspense fallback={null}>
        <BackToSignup />
      </Suspense>
      <PrivacyPolicy />
    </>
  );
}

export default page;
