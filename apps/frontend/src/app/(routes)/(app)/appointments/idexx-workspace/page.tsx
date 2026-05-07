import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'IDEXX Workspace — Yosemite Crew' };
import React from 'react';
import ProtectedIdexxWorkspace from '@/app/features/integrations/pages/IdexxWorkspace';

function page() {
  return <ProtectedIdexxWorkspace />;
}

export default page;
