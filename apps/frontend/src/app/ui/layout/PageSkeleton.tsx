'use client';
import React from 'react';

type PageSkeletonVariant = 'planner' | 'list' | 'settings' | 'dashboard' | 'generic';

type PageSkeletonProps = {
  variant?: PageSkeletonVariant;
};

/* --hairline, not --card-hover. The skeleton has no surface of its own, so it
   paints on the page ground, and --card-hover resolves through --neutral-100 to
   --screen-2, one step off that ground: 1.012 in dark and 1.027 in light. The
   bars were present and optically invisible on every loading page. The hairline
   step reads against the page in both themes (1.435 and 1.115). ChatSkeletons
   already made this exact move for the same reason. */
const shimmer = 'animate-pulse bg-[var(--hairline)] rounded-xl';

const TILE_IDS = ['tile-a', 'tile-b', 'tile-c'];
const GENERIC_ROWS = [
  { id: 'row-a', opacity: 1 },
  { id: 'row-b', opacity: 0.8 },
  { id: 'row-c', opacity: 0.6 },
];

const PlannerSkeleton = () => (
  <div className="flex flex-col gap-3 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-4! md:pb-3! lg:pl-5! lg:pr-5! lg:pt-4! lg:pb-3!">
    {/* Title row. `flex-wrap` is the phone case, not a nicety: the subtitle bar is a
        fixed w-72 and the three action bars are a nested flex row that will not shrink
        below its own 264px, so on a 390px screen the row needed 568px and pushed the
        whole page sideways - while the route it stands in for (planner: appointments,
        tasks, the workspace) is one every phone visit loads first. Wrapping puts the
        action bars on a second line instead. */}
    <div className="flex flex-wrap items-center justify-between gap-4">
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
    <div className={`h-[calc(100vh-200px)] min-h-[480px] ${shimmer}`} />
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
  <div className="mx-auto my-8 flex w-full max-w-[460px] flex-col gap-[14px] rounded-[20px] border border-[var(--hairline)] bg-[var(--screen)] px-6 py-[22px] shadow-[0_2px_6px_var(--sh05),0_18px_48px_var(--sh08)]">
    <div className="text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
      Page loading · skeleton
    </div>
    <div className="yc-shimmer h-[22px] w-[180px] rounded-lg bg-[var(--inset)]" />
    <div className="grid grid-cols-3 gap-[10px]">
      {TILE_IDS.map((id, index) => (
        <div
          key={id}
          className="yc-shimmer h-[74px] rounded-[14px] bg-[var(--inset)]"
          style={{ animationDelay: `${(index + 1) * 0.1}s` }}
        />
      ))}
    </div>
    <div className="flex flex-col gap-2">
      {GENERIC_ROWS.map((row, index) => (
        <div key={row.id} style={{ opacity: row.opacity }}>
          <div
            className="yc-shimmer h-[46px] rounded-xl bg-[var(--inset)]"
            style={{ animationDelay: `${0.15 + index * 0.1}s` }}
          />
        </div>
      ))}
    </div>
    <div className="text-[11px] text-[var(--ink-faint)]">
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
