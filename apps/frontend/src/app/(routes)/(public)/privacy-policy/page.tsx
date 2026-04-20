import React, { Suspense } from 'react';
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
