import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import { DevelopersPage } from '@/app/features/marketing/pages/DevelopersPage/DevelopersPage';

export const metadata: Metadata = {
  title: 'Developers · Yosemite Crew',
  description:
    'A FHIR-native API, a plugin marketplace, and a codebase you can actually read. Build an AI scribe, a triage agent or a smarter reminder, and ship it to working clinics.',
};

export default function Page() {
  return (
    <MarketingShell active="developers">
      <DevelopersPage />
    </MarketingShell>
  );
}
