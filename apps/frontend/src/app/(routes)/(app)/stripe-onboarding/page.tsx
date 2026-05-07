import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Stripe Onboarding — Yosemite Crew' };
import React from 'react';
import ProtectedStripeOnboarding from '@/app/features/onboarding/pages/StripeOnboarding';

function page() {
  return <ProtectedStripeOnboarding />;
}

export default page;
