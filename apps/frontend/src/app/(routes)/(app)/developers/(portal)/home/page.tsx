import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Developer Home — Yosemite Crew' };
import React from 'react';

import DeveloperPortalHome from '@/app/features/developers/pages/DeveloperPortalHome/DeveloperPortalHome';

function Page() {
  return <DeveloperPortalHome />;
}

export default Page;
