import React, { Suspense } from 'react';
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
