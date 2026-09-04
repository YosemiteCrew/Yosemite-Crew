import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Controlled drugs — Yosemite Crew' };
import React from 'react';
import ProtectedControlledSubstances from '@/app/features/compliance/pages/ControlledSubstances';

function page() {
  return <ProtectedControlledSubstances />;
}

export default page;
