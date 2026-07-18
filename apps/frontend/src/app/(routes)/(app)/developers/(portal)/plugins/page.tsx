import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Plugins — Yosemite Crew' };
import React from 'react';

import DeveloperPlugins from '@/app/features/developers/pages/DeveloperPlugins/DeveloperPlugins';

function Page() {
  return <DeveloperPlugins />;
}

export default Page;
