'use client';
import React from 'react';

type PageSkeletonVariant = 'planner' | 'list' | 'settings' | 'dashboard' | 'generic';

type PageSkeletonProps = {
  variant?: PageSkeletonVariant;
};

const shimmer = 'animate-pulse bg-card-hover rounded-xl';

const TILE_IDS = ['tile-a', 'tile-b', 'tile-c'];
const GENERIC_ROWS = [
  { id: 'row-a', opacity: 1 },
  { id: 'row-b', opacity: 0.7 },
  { id: 'row-c', opacity: 0.45 },
];

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
        <div className={`size-10 rounded-2xl ${shimmer}`} />
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

// Full-page loading skeleton per the design spec: a --screen card with an
// eyebrow, a title bar, a 3-col tile grid and stacked rows that shimmer via the
// ycShimmer keyframe (see globals.css). No spinners — the shape mirrors the page.
const GenericSkeleton = () => (
  <div className="mx-auto my-8 flex w-full max-w-[460px] flex-col gap-4 rounded-[20px] border border-[var(--hairline)] bg-[var(--screen)] p-6 shadow-[0_1px_2px_var(--sh05),0_12px_30px_var(--sh08)]">
    <div className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
      Page loading · skeleton
    </div>
    <div className="yc-shimmer h-[22px] w-[180px] rounded-lg bg-[var(--inset)]" />
    <div className="grid grid-cols-3 gap-3">
      {TILE_IDS.map((id, index) => (
        <div
          key={id}
          className="yc-shimmer h-[74px] rounded-xl bg-[var(--inset)]"
          style={{ animationDelay: `${index * 0.12}s` }}
        />
      ))}
    </div>
    <div className="flex flex-col gap-2.5">
      {GENERIC_ROWS.map((row, index) => (
        <div key={row.id} style={{ opacity: row.opacity }}>
          <div
            className="yc-shimmer h-[46px] rounded-xl bg-[var(--inset)]"
            style={{ animationDelay: `${index * 0.16}s` }}
          />
        </div>
      ))}
    </div>
    <div className="text-center text-[12px] text-[var(--ink-muted)]">
      Structure mirrors the loaded page. No spinners for full-page loads.
    </div>
  </div>
);

const PageSkeleton = ({ variant = 'planner' }: PageSkeletonProps) => {
  if (variant === 'list') return <ListSkeleton />;
  if (variant === 'settings') return <SettingsSkeleton />;
  if (variant === 'dashboard') return <DashboardSkeleton />;
  if (variant === 'generic') return <GenericSkeleton />;
  return <PlannerSkeleton />;
};

export default PageSkeleton;
