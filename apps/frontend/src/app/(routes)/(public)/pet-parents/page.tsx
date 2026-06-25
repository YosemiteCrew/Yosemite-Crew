import React from 'react';
import type { Metadata } from 'next';
import PetOwner from '@/app/features/marketing/pages/PetOwner/PetOwner';

export const metadata: Metadata = {
  title: 'Pet Parents — Yosemite Crew',
  description:
    'Designed for pet parents to manage companions, appointments, records, and wellness in one app.',
};

function page() {
  return <PetOwner />;
}

export default page;
