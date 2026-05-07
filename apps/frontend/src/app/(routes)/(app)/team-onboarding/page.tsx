import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Team Onboarding — Yosemite Crew' };
import React from 'react';
import ProtectedTeamOnboarding from '@/app/features/onboarding/pages/TeamOnboarding/TeamOnboarding';

function page() {
  return <ProtectedTeamOnboarding />;
}

export default page;
