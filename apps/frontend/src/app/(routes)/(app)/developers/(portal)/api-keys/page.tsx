import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'API Keys — Yosemite Crew' };
import React from 'react';

import DeveloperApiKeys from '@/app/features/developers/pages/DeveloperApiKeys/DeveloperApiKeys';

function Page() {
  return <DeveloperApiKeys />;
}

export default Page;
