import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My Integrations — Yosemite Crew' };
import React from 'react';

import DeveloperMyIntegrations from '@/app/features/developers/pages/DeveloperMyIntegrations/DeveloperMyIntegrations';

function Page() {
  return <DeveloperMyIntegrations />;
}

export default Page;
