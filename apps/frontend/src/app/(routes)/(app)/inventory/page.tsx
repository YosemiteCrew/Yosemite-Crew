import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Inventory — Yosemite Crew' };
import React from 'react';
import ProtectedInventory from '@/app/features/inventory/pages/Inventory';

function page() {
  return <ProtectedInventory />;
}

export default page;
