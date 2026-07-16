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
        className="flex items-center gap-2 w-fit text-body-4 text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Go back"
      >
        <IoArrowBack size={18} />
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
