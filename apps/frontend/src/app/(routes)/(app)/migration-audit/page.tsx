import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Migration audit — Yosemite Crew' };
import React from 'react';
import MigrationAudit from '@/app/features/onboarding/pages/MigrationAudit/MigrationAudit';

function page() {
  return <MigrationAudit />;
}

export default page;
