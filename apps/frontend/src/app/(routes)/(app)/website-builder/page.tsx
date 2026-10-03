import type { Metadata } from 'next';
import React from 'react';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import WebsiteBuilder from '@/app/features/websiteBuilder/pages/WebsiteBuilder/WebsiteBuilder';

// no-story: thin Next.js route wrapper (guards + metadata only); real content is WebsiteBuilder, already storied
export const metadata: Metadata = { title: 'Website builder — Yosemite Crew' };

const Page = () => (
  <ProtectedRoute>
    <OrgGuard>
      <WebsiteBuilder />
    </OrgGuard>
  </ProtectedRoute>
);

export default Page;
