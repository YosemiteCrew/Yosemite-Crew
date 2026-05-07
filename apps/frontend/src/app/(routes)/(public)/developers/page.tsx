import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developers — Yosemite Crew',
  description:
    'Build, customise, and launch powerful apps on the Yosemite Crew open-source platform.',
};
import DeveloperLanding from '@/app/features/marketing/pages/DeveloperLanding/DeveloperLanding';

function page() {
  return <DeveloperLanding />;
}

export default page;
