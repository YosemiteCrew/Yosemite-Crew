import React from 'react';
import type { Metadata } from 'next';
import { getEnv } from '@/app/lib/env';
import HomePage from '@/app/features/marketing/pages/HomePage/HomePage';

export const metadata: Metadata = {
  title: 'Pet Businesses — Yosemite Crew',
  description:
    'Everything you need to run your pet business — appointments, records, billing, and more.',
};

function page() {
  return (
    <HomePage
      macDownloadHref={getEnv('NEXT_PUBLIC_MAC_APP_DOWNLOAD_URL')}
      windowsDownloadHref={getEnv('NEXT_PUBLIC_WINDOWS_APP_DOWNLOAD_URL')}
    />
  );
}

export default page;
