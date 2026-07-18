import React from 'react';
import type { Metadata } from 'next';
import BookDemo from '@/app/features/marketing/pages/BookDemo/BookDemo';
import { MarketingShell } from '@/app/features/marketing/site';

export const metadata: Metadata = {
  title: 'Book a Demo — Yosemite Crew',
  description: 'Schedule a live demo to see how Yosemite Crew can help your pet business.',
};

function page() {
  return (
    <MarketingShell>
      <BookDemo />
    </MarketingShell>
  );
}

export default page;
