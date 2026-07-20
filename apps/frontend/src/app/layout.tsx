import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Newsreader } from 'next/font/google';
import './globals.css';

// Warm-bone display serif for page titles + greeting moments. Self-hosted by next/font
// at build time (served from /_next, so it satisfies the strict app-route CSP), exposed
// as --font-newsreader-src which the --font-newsreader token consumes (see globals.css).
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader-src',
  display: 'swap',
});

import 'react-datepicker/dist/react-datepicker.css';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import GlobalFullscreenLoaderOverlay from '@/app/ui/layout/GlobalFullscreenLoaderOverlay';
import RouteLoaderOverlay from '@/app/ui/layout/RouteLoaderOverlay';
import PostHogBootstrap from '@/app/ui/layout/PostHogBootstrap';
import PostHogUserSync from '@/app/ui/layout/PostHogUserSync';
import RouteAnnouncer from '@/app/ui/layout/RouteAnnouncer';
import SkipLink from '@/app/ui/layout/SkipLink';
import Cookies from '@/app/ui/widgets/Cookies/Cookies';

export const metadata: Metadata = {
  title: 'Yosemite Crew',
  description: 'Get Yosemite Crew for your pet business',
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
  return (
    <html lang="en" suppressHydrationWarning className={newsreader.variable}>
      <body>
        <SkipLink />
        <Cookies />
        <PostHogBootstrap />
        <PostHogUserSync />
        <Suspense>
          <RouteAnnouncer />
        </Suspense>
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
