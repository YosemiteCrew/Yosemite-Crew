import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Organizations — Yosemite Crew' };
import React from 'react';
import ProtectedOrganizations from '@/app/features/organizations/pages/Organizations';

function page() {
  return <ProtectedOrganizations />;
}

export default page;
