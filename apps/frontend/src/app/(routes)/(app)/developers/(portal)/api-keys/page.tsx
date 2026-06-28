import type { Metadata } from 'next';
import React from 'react';

import DeveloperApiKeys from '@/app/features/developers/pages/DeveloperApiKeys/DeveloperApiKeys';

export const metadata: Metadata = { title: 'API Keys — Yosemite Crew' };

function Page() {
  return <DeveloperApiKeys />;
}

export default Page;
