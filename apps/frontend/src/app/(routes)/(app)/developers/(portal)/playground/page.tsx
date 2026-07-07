import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Agent Playground - Yosemite Crew' };
import React from 'react';

import DeveloperPlayground from '@/app/features/developers/pages/DeveloperPlayground/DeveloperPlayground';

function Page() {
  return <DeveloperPlayground />;
}

export default Page;
