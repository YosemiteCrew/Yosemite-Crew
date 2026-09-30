import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'MCP playground — Yosemite Crew' };
import React from 'react';

import DeveloperMCPPlayground from '@/app/features/developers/pages/DeveloperMCPPlayground/DeveloperMCPPlayground';

function Page() {
  return <DeveloperMCPPlayground />;
}

export default Page;
