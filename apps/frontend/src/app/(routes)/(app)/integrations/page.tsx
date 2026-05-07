import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Integrations — Yosemite Crew' };
import React from 'react';
import ProtectedIntegrations from '@/app/features/integrations/pages/Integrations';

function page() {
  return <ProtectedIntegrations />;
}

export default page;
