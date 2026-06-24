import React from 'react';
import type { Metadata } from 'next';
import DmcaCopyrightPolicy from '@/app/features/legal/pages/DmcaCopyrightPolicy';
import Footer from '@/app/ui/widgets/Footer/Footer';

export const metadata: Metadata = {
  title: 'DMCA Copyright Policy - Yosemite Crew',
  description: 'Read the Yosemite Crew DMCA copyright policy and contact our copyright agent.',
};

const DmcaPage = () => {
  return (
    <>
      <DmcaCopyrightPolicy />
      <Footer />
    </>
  );
};

export default DmcaPage;
