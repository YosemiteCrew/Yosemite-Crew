'use client';

import React from 'react';
import Github from '@/app/ui/widgets/Github/Github';
import Header from '@/app/ui/layout/Header/Header';

export default function PublicShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      <Github />
      <Header />
      <div className="yc-public-page flex-1">{children}</div>
    </>
  );
}
