import React from 'react';

/* --hairline, not --inset: in dark the inset step (#302820) sits 1.01:1 on the
   screen ground (#2f271e), so the bars were technically present and optically
   invisible. The hairline step reads against both grounds in both themes. */
const bar = 'yc-shimmer rounded-full bg-[var(--hairline)]';

/**
 * Warm-bone stand-ins for Stream's `LoadingChannels` / `LoadingChannel`
 * placeholders. Stream's own skeletons paint their bars from theme variables
 * we never mapped, so in dark mode the list and thread flashed white with grey
 * bars before the first channel arrived. These mirror the loaded layout
 * (avatar disc + two lines per row; header, three messages, composer) on the
 * app's own --inset shimmer, in both themes.
 */
export const ChatListSkeleton = () => (
  <div
    className="flex flex-col gap-1 px-2 py-2"
    role="status"
    aria-live="polite"
    aria-label="Loading conversations"
    data-testid="chat-list-skeleton"
  >
    {['a', 'b', 'c', 'd'].map((id, index) => (
      <div
        key={id}
        className="flex items-center gap-3 px-2 py-3"
        style={{ opacity: 1 - index * 0.18 }}
      >
        <span className={`${bar} size-10 shrink-0`} />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className={`${bar} h-3 w-2/5`} />
          <span className={`${bar} h-2.5 w-4/5`} />
        </span>
        <span className={`${bar} h-2.5 w-9 shrink-0`} />
      </div>
    ))}
  </div>
);

export const ChatThreadSkeleton = () => (
  <div
    className="flex h-full min-h-0 flex-1 flex-col"
    role="status"
    aria-live="polite"
    aria-label="Loading conversation"
    data-testid="chat-thread-skeleton"
  >
    <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-5 py-4">
      <span className={`${bar} size-10 shrink-0`} />
      <span className="flex flex-col gap-2">
        <span className={`${bar} h-3 w-36`} />
        <span className={`${bar} h-2.5 w-24`} />
      </span>
    </div>
    <div className="flex flex-1 flex-col justify-end gap-5 px-6 py-6">
      {[
        { id: 'in-1', mine: false, w: 'w-3/5' },
        { id: 'out-1', mine: true, w: 'w-2/5' },
        { id: 'in-2', mine: false, w: 'w-1/2' },
      ].map(({ id, mine, w }) => (
        <div key={id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
          <span className={`${bar} size-8 shrink-0`} />
          <span className={`${bar} h-10 ${w} rounded-[16px]`} />
        </div>
      ))}
    </div>
    <div className="flex items-center gap-3 border-t border-[var(--hairline)] px-5 py-4">
      <span className={`${bar} h-11 flex-1 rounded-[22px]`} />
      <span className={`${bar} size-11 shrink-0`} />
    </div>
  </div>
);
