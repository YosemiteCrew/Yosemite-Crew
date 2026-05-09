import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Organisation — Yosemite Crew' };
import React from 'react';
import dynamic from 'next/dynamic';

const ProtectedOrganization = dynamic(
  () => import('@/app/features/organization/pages/Organization'),
  {
    loading: () => <div className="min-h-[50vh]" aria-hidden="true" />,
  }
);

function page() {
  return <ProtectedOrganization />;
}

export default page;
