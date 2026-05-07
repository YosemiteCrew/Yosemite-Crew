import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a Demo — Yosemite Crew',
  description: 'Schedule a live demo to see how Yosemite Crew can help your pet business.',
};
import BookDemo from '@/app/features/marketing/pages/BookDemo/BookDemo';

function page() {
  return <BookDemo />;
}

export default page;
