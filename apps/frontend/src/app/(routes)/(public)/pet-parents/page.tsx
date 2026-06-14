import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Application — Yosemite Crew' };
import React from 'react';
import PetOwner from '@/app/features/marketing/pages/PetOwner/PetOwner';

function page() {
  return <PetOwner />;
}

export default page;
