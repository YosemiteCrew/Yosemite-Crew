import type { Metadata } from 'next';
import { MarketingShell } from '@/app/features/marketing/site';
import { PetParents } from '@/app/features/marketing/pages/PetParents/PetParents';

export const metadata: Metadata = {
  title: 'Pet Parents · Yosemite Crew',
  description:
    'Cats, dogs and horses, every visit and every dose on one timeline. The years of notes that keep a companion alive finally live somewhere you can reach.',
};

export default function Page() {
  return (
    <MarketingShell active="pet-parents">
      <PetParents />
    </MarketingShell>
  );
}
