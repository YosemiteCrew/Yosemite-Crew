import type { Metadata } from 'next';
import React from 'react';
import { EmbeddedMerckManuals } from '@/app/features/integrations/pages/MerckManuals';

export const metadata: Metadata = {
  title: 'MSD Veterinary Manual — Yosemite Crew',
  description: 'Embedded MSD Veterinary Manual reference for veterinary professionals.',
};

function page() {
  // A product surface on bone, but outside the (app) layout, so it needs the
  // readable-ink marker of its own - see body:has([data-yc-app]) in globals.css.
  // `display: contents` keeps it out of the box tree.
  return (
    <div data-yc-app style={{ display: 'contents' }}>
      <EmbeddedMerckManuals />
    </div>
  );
}

export default page;
