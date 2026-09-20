import React from 'react';
import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import ContactusPage from '@/app/features/marketing/pages/ContactusPage/ContactusPage';

// no-story: thin Next.js route wrapper; real content is ContactusPage, already storied
export const metadata: Metadata = {
  title: 'Contact · Yosemite Crew',
  description:
    'Talk to a human. Run a clinic, live with a house full of animals, or want to build on the platform. Tell us which, and it reaches the right desk, not a queue.',
};

export default function Page() {
  return (
    <MarketingShell active="contact">
      <ContactusPage />
    </MarketingShell>
  );
}
