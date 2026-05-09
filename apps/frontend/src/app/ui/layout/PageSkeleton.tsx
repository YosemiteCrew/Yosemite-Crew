'use client';
import React from 'react';

type PageSkeletonVariant = 'planner' | 'list' | 'settings' | 'dashboard';

type PageSkeletonProps = {
  variant?: PageSkeletonVariant;
};

const shimmer = 'animate-pulse bg-card-hover rounded-xl';

const PlannerSkeleton = () => (
  <div className="flex flex-col gap-3 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-4! md:pb-3! lg:pl-5! lg:pr-5! lg:pt-4! lg:pb-3!">
    {/* Title row */}
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className={`h-7 w-44 ${shimmer}`} />
        <div className={`h-4 w-72 ${shimmer}`} />
      </div>
      <div className="flex items-center gap-2">
        <div className={`h-10 w-24 rounded-2xl ${shimmer}`} />
        <div className={`h-10 w-10 rounded-2xl ${shimmer}`} />
        <div className={`h-10 w-28 rounded-2xl ${shimmer}`} />
      </div>
    </div>
    {/* Header bar skeleton (mimics the calendar header with filter pills) */}
    <div className={`h-14 w-full rounded-2xl ${shimmer}`} />
    {/* Main content area */}
    <div className="h-[calc(100vh-200px)] min-h-[480px] rounded-2xl bg-card-hover animate-pulse" />
  </div>
);

const ListSkeleton = () => (
  <div className="flex flex-col gap-4 px-5 pt-4 pb-3">
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className={`h-7 w-40 ${shimmer}`} />
        <div className={`h-4 w-64 ${shimmer}`} />
      </div>
      <div className={`h-10 w-32 rounded-2xl ${shimmer}`} />
    </div>
    <div className={`h-12 w-full rounded-2xl ${shimmer}`} />
    <div className="flex flex-col gap-3">
      {['a', 'b', 'c', 'd', 'e', 'f'].map((id) => (
        <div key={`list-row-${id}`} className={`h-16 w-full rounded-2xl ${shimmer}`} />
      ))}
    </div>
  </div>
);

const SettingsSkeleton = () => (
  <div className="flex flex-col gap-4 px-5 pt-4 pb-3">
    <div className="flex flex-col gap-2">
      <div className={`h-7 w-36 ${shimmer}`} />
      <div className={`h-4 w-60 ${shimmer}`} />
    </div>
    <div className="flex gap-4">
      <div className={`h-[calc(100vh-140px)] min-h-[480px] w-52 shrink-0 rounded-2xl ${shimmer}`} />
      <div className={`h-[calc(100vh-140px)] min-h-[480px] flex-1 rounded-2xl ${shimmer}`} />
    </div>
  </div>
);

const DashboardSkeleton = () => (
  <div className="flex flex-col gap-4 px-5 pt-4 pb-3">
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className={`h-7 w-44 ${shimmer}`} />
        <div className={`h-4 w-56 ${shimmer}`} />
      </div>
    </div>
    {/* Stat row */}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {['a', 'b', 'c', 'd'].map((id) => (
        <div key={`stat-${id}`} className={`h-28 rounded-2xl ${shimmer}`} />
      ))}
    </div>
    {/* Card row */}
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {['a', 'b', 'c', 'd'].map((id) => (
        <div key={`card-${id}`} className={`h-52 rounded-2xl ${shimmer}`} />
      ))}
    </div>
  </div>
);

const PageSkeleton = ({ variant = 'planner' }: PageSkeletonProps) => {
  if (variant === 'list') return <ListSkeleton />;
  if (variant === 'settings') return <SettingsSkeleton />;
  if (variant === 'dashboard') return <DashboardSkeleton />;
  return <PlannerSkeleton />;
};

export default PageSkeleton;
