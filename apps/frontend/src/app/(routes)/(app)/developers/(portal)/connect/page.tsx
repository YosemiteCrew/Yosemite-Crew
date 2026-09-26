import type { Metadata } from 'next';
import React from 'react';

import DeveloperConnect from '@/app/features/developers/pages/DeveloperConnect/DeveloperConnect';

export const metadata: Metadata = { title: 'Connect a coding tool — Yosemite Crew' };

function Page() {
  return <DeveloperConnect />;
}

export default Page;
