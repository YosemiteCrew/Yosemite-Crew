import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Companions — Yosemite Crew' };
import React from 'react';
import ProtectedCompanions from '@/app/features/companions/pages/Companions/Companions';

function page() {
  return <ProtectedCompanions />;
}

export default page;
