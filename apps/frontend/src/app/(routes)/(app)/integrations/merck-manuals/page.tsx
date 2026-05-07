import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'MSD Veterinary Manual — Yosemite Crew' };
import React from 'react';
import ProtectedMerckManuals from '@/app/features/integrations/pages/MerckManuals';

function page() {
  return <ProtectedMerckManuals />;
}

export default page;
