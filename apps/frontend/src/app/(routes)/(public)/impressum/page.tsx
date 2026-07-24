import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import Impressum from '@/app/features/legal/pages/Impressum';

export const metadata: Metadata = {
  title: 'Impressum · Yosemite Crew',
  description:
    'Legal notice and provider identification under § 5 DDG (Digitale-Dienste-Gesetz) and § 18 (2) MStV. DuneXploration UG (haftungsbeschränkt), Mainz.',
};

export default function Page() {
  return (
    <MarketingShell>
      <Impressum />
    </MarketingShell>
  );
}
