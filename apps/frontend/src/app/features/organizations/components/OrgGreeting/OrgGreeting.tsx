'use client';
import React from 'react';

import { useAuthStore } from '@/app/stores/authStore';

import { getTimeGreeting } from './orgGreeting.utils';

type OrgGreetingProps = {
  orgCount: number;
};

const OrgGreeting = ({ orgCount }: OrgGreetingProps) => {
  const attributes = useAuthStore((s) => s.attributes);
  const firstName = attributes?.given_name?.trim() ?? '';

  const timeGreeting = getTimeGreeting(new Date().getHours());
  const greeting = firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;
  const orgWord = orgCount === 1 ? 'organization' : 'organizations';

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="font-newsreader text-[17px] italic text-[var(--blue-text)]">{greeting}</span>
      <h1 className="font-newsreader text-[30px] font-normal leading-[1.2] tracking-[-0.02em] text-[var(--ink)]">
        Where are you working today?
      </h1>
      <span className="mb-[18px] font-satoshi text-[13.5px] text-[var(--ink-muted)]">
        You belong to {orgCount} {orgWord}
      </span>
    </div>
  );
};

export default OrgGreeting;
