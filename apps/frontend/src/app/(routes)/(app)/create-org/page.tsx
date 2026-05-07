import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Create Organisation — Yosemite Crew' };
import React from 'react';
import ProtectedCreateOrg from '@/app/features/onboarding/pages/CreateOrg/CreateOrg';

function page() {
  return <ProtectedCreateOrg />;
}

export default page;
