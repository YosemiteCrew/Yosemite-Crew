import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'API playground — Yosemite Crew' };
import React from 'react';

import DeveloperPlayground from '@/app/features/developers/pages/DeveloperPlayground/DeveloperPlayground';

type PageProps = {
  searchParams?: Promise<{ operation?: string | string[]; export?: string | string[] }>;
};

async function Page({ searchParams }: Readonly<PageProps>) {
  const params = searchParams ? await searchParams : {};
  return (
    <DeveloperPlayground
      initialOperationId={typeof params.operation === 'string' ? params.operation : undefined}
      initialExportTab={params.export === 'mcp' ? 'mcp' : 'curl'}
    />
  );
}

export default Page;
