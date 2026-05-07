import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';

import 'react-datepicker/dist/react-datepicker.css';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import GlobalFullscreenLoaderOverlay from '@/app/ui/layout/GlobalFullscreenLoaderOverlay';
import RouteLoaderOverlay from '@/app/ui/layout/RouteLoaderOverlay';
import ClarityScript from '@/app/ui/layout/ClarityScript';
import RouteAnnouncer from '@/app/ui/layout/RouteAnnouncer';
import SkipLink from '@/app/ui/layout/SkipLink';

export const metadata: Metadata = {
  title: 'Yosemite Crew',
  description: 'Get Yosemite Crew PMS for your pet business',
  icons: [
    { rel: 'icon', url: '/favicon.ico', type: 'image/x-icon' },
    {
      rel: 'icon',
      url: '/favicon-32x32.png',
      sizes: '32x32',
      type: 'image/png',
    },
    {
      rel: 'icon',
      url: '/favicon-16x16.png',
      sizes: '16x16',
      type: 'image/png',
    },
    { rel: 'apple-touch-icon', url: '/apple-touch-icon.png', sizes: '180x180' },
  ],
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clarityProjectId = process.env.NEXT_PUBLIC_MICROSOFT_CLARITY_ID?.trim();

  return (
    <html lang="en">
      <body>
        <SkipLink />
        {clarityProjectId ? <ClarityScript projectId={clarityProjectId} /> : null}
        <RouteAnnouncer />
        {children}
        <GlobalFullscreenLoaderOverlay />
        <Suspense>
          <RouteLoaderOverlay />
        </Suspense>
        <ToastProvider />
      </body>
    </html>
  );
}
