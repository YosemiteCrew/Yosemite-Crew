import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Finance — Yosemite Crew' };
import React from 'react';
import ProtectedFinance from '@/app/features/finance/pages/Finance';

const page = () => {
  return <ProtectedFinance />;
};

export default page;
