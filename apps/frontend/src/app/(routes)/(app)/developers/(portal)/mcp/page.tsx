import type { Metadata } from 'next';

import DeveloperMCPPlayground from '@/app/features/developers/pages/DeveloperMCPPlayground/DeveloperMCPPlayground';

export const metadata: Metadata = { title: 'MCP playground — Yosemite Crew' };

function Page() {
  return <DeveloperMCPPlayground />;
}

export default Page;
