import React from 'react';

import './GenericTable/Generictable.css';

export type TableHeadColumn = {
  /** Stable key; also used when the label is blank (spacer/action columns). */
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
};

export type TableHeadProps = {
  columns: ReadonlyArray<TableHeadColumn>;
  /**
   * `grid-template-columns` track. Must be the SAME value the rows below use,
   * or the header labels stop lining up with their columns.
   */
  track: string;
  /**
   * Sticky by default, matching `.TableDiv thead tr th`. Pass false inside a
   * drawer or a transformed parent, where sticky resolves against the wrong
   * container and strands the band mid-panel.
   */
  sticky?: boolean;
  /** Layout-only extras (breakpoint prefixes, min-width, scroll hooks). */
  className?: string;
  gap?: string;
};

const alignClass: Record<NonNullable<TableHeadColumn['align']>, string> = {
  left: '',
  right: 'text-right',
  center: 'text-center',
};

/**
 * The column-header band for list shells that are not a `<table>`.
 *
 * PIMS grew four of these by hand - the Organisation Team/Rooms grid, the
 * Specialities services grid, the inventory grid shell and the companions grid
 * - and they drifted apart, so a single page could show three header sizes over
 * the same `--screen-2` band. The appearance lives in `.yc-table-head`, kept
 * byte-for-byte in step with `.TableDiv thead tr th`; this component exists so
 * callers reach for markup instead of copying a class string, which is how the
 * drift happened. A real `<table>` should use GenericTable instead of this.
 *
 * Deliberately carries NO ARIA table roles. `role="columnheader"` requires a
 * `role="table"`/`grid` ancestor, and the rows these shells render alongside are
 * plain divs - announcing a header for a table a screen reader cannot then
 * navigate is worse than announcing nothing. Giving these shells real table
 * semantics means marking up the rows too, which is a larger change than a
 * shared header band.
 */
const TableHead = ({
  columns,
  track,
  sticky = true,
  className = '',
  gap = '10px',
}: TableHeadProps) => (
  <div
    className={`yc-table-head ${sticky ? '' : 'yc-table-head--static'} grid items-center ${className}`.trim()}
    style={{ gridTemplateColumns: track, gap }}
  >
    {columns.map((col) =>
      col.label ? (
        <span key={col.key} className={alignClass[col.align ?? 'left']}>
          {col.label}
        </span>
      ) : (
        // Spacer columns (avatars, row actions) hold their track without
        // announcing an empty header to a screen reader.
        <span key={col.key} aria-hidden="true" />
      )
    )}
  </div>
);

export default TableHead;
