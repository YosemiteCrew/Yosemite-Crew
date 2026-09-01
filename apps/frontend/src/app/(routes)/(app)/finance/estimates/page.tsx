import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Estimates — Yosemite Crew' };
import React from 'react';
import ProtectedEstimates from '@/app/features/finance/pages/Estimates';

const page = () => {
  return <ProtectedEstimates />;
};

export default page;
