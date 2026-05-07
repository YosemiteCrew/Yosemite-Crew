import React from 'react';
import type { Metadata } from 'next';
import ContactusPage from '@/app/features/marketing/pages/ContactusPage/ContactusPage';

export const metadata: Metadata = {
  title: 'Contact Us — Yosemite Crew',
  description: 'Get in touch with the Yosemite Crew team. We are happy to assist you.',
};

function page() {
  return <ContactusPage />;
}

export default page;
