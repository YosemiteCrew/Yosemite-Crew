import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Discounts — Yosemite Crew' };
import React from 'react';
import ProtectedDiscounts from '@/app/features/finance/pages/Discounts';

const page = () => {
  return <ProtectedDiscounts />;
};

export default page;
