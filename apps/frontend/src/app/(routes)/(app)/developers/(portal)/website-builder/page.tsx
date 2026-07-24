import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Website Builder — Yosemite Crew' };
import React from 'react';

import DeveloperWebsiteBuilder from '@/app/features/developers/pages/DeveloperWebsiteBuilder/DeveloperWebsiteBuilder';

function Page() {
  return <DeveloperWebsiteBuilder />;
}

export default Page;
