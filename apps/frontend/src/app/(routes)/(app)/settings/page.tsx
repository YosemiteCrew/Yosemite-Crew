import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Settings — Yosemite Crew' };
import React from 'react';
import ProtectedSettings from '@/app/features/settings/pages/Settings';

function page() {
  return <ProtectedSettings />;
}

export default page;
