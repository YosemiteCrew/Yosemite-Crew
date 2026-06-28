import type { Metadata } from 'next';
import React from 'react';

import DeveloperBilling from '@/app/features/developers/pages/DeveloperBilling/DeveloperBilling';

export const metadata: Metadata = { title: 'Billing — Yosemite Crew' };

function Page() {
  return <DeveloperBilling />;
}

export default Page;
