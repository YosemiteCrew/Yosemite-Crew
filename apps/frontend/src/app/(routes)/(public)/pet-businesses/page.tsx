import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import { PetBusinesses } from '@/app/features/marketing/pages/PetBusinesses/PetBusinesses';

export const metadata: Metadata = {
  title: 'Pet Businesses · Yosemite Crew',
  description:
    'Appointments, records, SOAP notes, invoicing and inventory, the whole clinic in one system instead of six tabs and a notebook of workarounds. Built to keep working on the worst afternoon, not just the demo.',
};

export default function Page() {
  return (
    <MarketingShell active="pet-businesses">
      <PetBusinesses />
    </MarketingShell>
  );
}
