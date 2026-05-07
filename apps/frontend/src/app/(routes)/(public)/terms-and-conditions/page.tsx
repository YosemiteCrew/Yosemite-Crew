import React, { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions — Yosemite Crew',
  description: 'Read the Terms and Conditions for using Yosemite Crew.',
};
import Footer from '@/app/ui/widgets/Footer/Footer';
import TermsAndConditions from '@/app/features/legal/pages/TermsAndConditions';
import BackToSignup from '@/app/features/legal/components/BackToSignup';

function page() {
  return (
    <div>
      <Suspense fallback={null}>
        <BackToSignup />
      </Suspense>
      <TermsAndConditions />
      <Footer />
    </div>
  );
}

export default page;
