import type { Metadata } from 'next';
import React from 'react';

import DeveloperFormDraftImport from '@/app/features/developers/pages/DeveloperFormDraftImport/DeveloperFormDraftImport';

export const metadata: Metadata = { title: 'Form draft import — Yosemite Crew' };

function Page() {
  return <DeveloperFormDraftImport />;
}

export default Page;
