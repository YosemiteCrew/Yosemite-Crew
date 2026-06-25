import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Calculators — Yosemite Crew' };
import React from 'react';
import Calculators from '@/app/features/calculators/pages/Calculators';

function page() {
  return <Calculators />;
}

export default page;
