import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Guides — Yosemite Crew' };
import React from 'react';
import ProtectedGuides from '@/app/features/guides/pages/Guides';

function page() {
  return <ProtectedGuides />;
}

export default page;
