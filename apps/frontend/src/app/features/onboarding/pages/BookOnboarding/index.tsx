'use client';
import React from 'react';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { useRouter } from 'next/navigation';
import { IoArrowBack } from 'react-icons/io5';
import CalEmbedFrame from '@/app/ui/overlays/CalEmbedFrame';

const BookOnboarding = () => {
  const router = useRouter();

  return (
    <div className="yc-page-content">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex h-[38px] w-fit items-center gap-[7px] rounded-full border px-4 text-[12.5px] font-semibold"
        style={{ borderColor: 'var(--hairline)', color: 'var(--ink-body)' }}
        aria-label="Go back"
      >
        <IoArrowBack size={14} />
        <span>Back</span>
      </button>
      <CalEmbedFrame
        calLink="yosemitecrew/onboarding"
        title="Book onboarding call"
        className="min-h-[calc(100vh-120px)] w-full border-0"
      />
    </div>
  );
};

const ProtectedBookOnboarding = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <BookOnboarding />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedBookOnboarding;
