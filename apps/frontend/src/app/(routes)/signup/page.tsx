// src/app/signup/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import React, { useMemo } from 'react';
import SignUp from '@/app/Pages/Sign/SignUp';

export default function Page() {
  const searchParams = useSearchParams();
  const { inviteCode } = useMemo(() => ({
    inviteCode: searchParams.get('inviteCode') ?? '',
  }), [searchParams]);

 
  return (
    <SignUp
      inviteCode={inviteCode}
    />
  );
}
