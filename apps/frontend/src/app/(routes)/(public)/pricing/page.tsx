import React from 'react';
import type { Metadata } from 'next';
import PricingPage from '@/app/features/marketing/pages/PricingPage/PricingPage';

export const metadata: Metadata = {
  title: 'Pricing — Yosemite Crew',
  description:
    'Transparent pricing with no hidden fees. Choose a plan that fits your pet-care practice.',
};

function page() {
  return <PricingPage />;
}

export default page;
