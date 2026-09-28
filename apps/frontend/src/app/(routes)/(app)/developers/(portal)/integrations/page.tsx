import type { Metadata } from 'next';
import React from 'react';
import DeveloperMyIntegrations from '@/app/features/developers/pages/DeveloperMyIntegrations/DeveloperMyIntegrations';
export const metadata: Metadata = { title: 'My integrations — Yosemite Crew' };
export default function Page() {
  return <DeveloperMyIntegrations />;
}
