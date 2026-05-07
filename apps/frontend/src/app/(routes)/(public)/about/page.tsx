import React from 'react';
import type { Metadata } from 'next';
import AboutUs from '@/app/features/marketing/pages/AboutUs/AboutUs';

export const metadata: Metadata = {
  title: 'About Us — Yosemite Crew',
  description:
    'Learn about Yosemite Crew — the open-source community building better tools for pet businesses and animal health.',
};

function page() {
  return <AboutUs />;
}

export default page;
