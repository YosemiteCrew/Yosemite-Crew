'use client';
import React from 'react';

import { useAuthStore } from '@/app/stores/authStore';

type OrgGreetingProps = {
  orgCount: number;
};

export const getTimeGreeting = (hour: number): string => {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const OrgGreeting = ({ orgCount }: OrgGreetingProps) => {
  const attributes = useAuthStore((s) => s.attributes);
  const firstName = attributes?.given_name?.trim() ?? '';

  const timeGreeting = getTimeGreeting(new Date().getHours());
  const greeting = firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;
  const orgWord = orgCount === 1 ? 'organization' : 'organizations';

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="font-newsreader text-body-2 italic text-text-brand">{greeting}</span>
      <h1 className="font-newsreader text-heading-2 text-text-primary">
        Where are you working today?
      </h1>
      <span className="text-body-4 text-text-tertiary">
        You belong to {orgCount} {orgWord}
      </span>
    </div>
  );
};

export default OrgGreeting;
