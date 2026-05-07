import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Companion History — Yosemite Crew' };
import React from 'react';
import CompanionHistoryPage from '@/app/features/companionHistory/pages/CompanionHistoryPage';

function page() {
  return <CompanionHistoryPage />;
}

export default page;
