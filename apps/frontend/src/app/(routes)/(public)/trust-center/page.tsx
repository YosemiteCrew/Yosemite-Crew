import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trust Center — Yosemite Crew',
  description: 'Yosemite Crew security, compliance, and data protection information.',
};
import { TrustCenter } from '@/app/features/legal';
import Footer from '@/app/ui/widgets/Footer/Footer';

const TrustCenterPage = () => {
  return (
    <>
      <TrustCenter />
      <Footer />
    </>
  );
};

export default TrustCenterPage;
