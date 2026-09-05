import React from 'react';

/**
 * Empty and loading states shared by the record panels (waitlist, check-in
 * board, inventory alerts, and the panels that follow the same shape).
 *
 * Each panel carried its own byte-identical copy of these, which both drifted
 * and tripped the duplicated-lines gate. The field classes live here too so a
 * panel's form controls stay visually identical to its siblings by
 * construction.
 */

export const panelFieldLabelClass = 'text-[11.5px] font-semibold text-[var(--ink-muted)]';
export const panelInputClass =
  'w-full rounded-lg border border-[var(--hairline)] bg-[var(--screen)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[var(--ink-muted)]';

/** Centred message for a panel that has no rows to show. */
export const PanelEmptyState = ({ message }: { message: string }) => (
  <p className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-faint)]">{message}</p>
);

/**
 * Three placeholder rows while a panel loads. `rowClass` is the panel's own row
 * class so the skeleton lines up with the rows it stands in for.
 */
export const PanelLoadingRows = ({ rowClass }: { rowClass: string }) => (
  <ul className="divide-y divide-[var(--divider)]" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className={rowClass}>
        <span className="h-3.5 w-40 rounded bg-[var(--inset)]" />
        <span className="h-5 w-16 rounded-full bg-[var(--inset)]" />
      </li>
    ))}
  </ul>
);
