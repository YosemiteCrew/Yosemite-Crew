import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import TrustCenter from '@/app/features/legal/pages/TrustCenter';

export const metadata: Metadata = {
  title: 'Security, privacy and compliance · Yosemite Crew',
  description:
    'Protecting the data of pet businesses and pet parents is our foundation, not a feature. We use enterprise-grade security so your data stays safe, compliant and available.',
};

const TrustCenterPage = () => {
  return (
    <MarketingShell>
      <TrustCenter />
    </MarketingShell>
  );
};

export default TrustCenterPage;
