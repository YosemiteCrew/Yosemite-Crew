import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Forms — Yosemite Crew' };
import React from 'react';
import dynamic from 'next/dynamic';

const ProtectedForms = dynamic(() => import('@/app/features/forms/pages/Forms'), {
  loading: () => <div className="min-h-[50vh]" aria-hidden="true" />,
});

function page() {
  return <ProtectedForms />;
}

export default page;
