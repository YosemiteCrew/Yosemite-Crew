import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Forms — Yosemite Crew' };
import React from 'react';
import ProtectedForms from '@/app/features/forms/pages/Forms';

function page() {
  return <ProtectedForms />;
}

export default page;
