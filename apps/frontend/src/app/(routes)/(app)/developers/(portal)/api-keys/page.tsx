import type { Metadata } from 'next';
import React from 'react';

import DeveloperApiKeys from '@/app/features/developers/pages/DeveloperApiKeys/DeveloperApiKeys';

export const metadata: Metadata = { title: 'API Keys — Yosemite Crew' };

type PageProps = { searchParams?: Promise<{ setup?: string | string[] }> };

async function Page({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  return <DeveloperApiKeys guidedAppointmentTest={params.setup === 'appointment-test'} />;
}

export default Page;
