import React from 'react';
import { LuPlus } from 'react-icons/lu';

type WorkspaceSearchResultRowProps = {
  /** Primary label (service, package, medicine, or template name). */
  name: string;
  onSelect: () => void;
  /**
   * Leading affordance. Defaults to a plus icon; pass `null` to omit it, or a
   * different icon (e.g. a search glyph) to match the calling search bar.
   */
  leadingIcon?: React.ReactNode;
  /** Source/kind badge (e.g. Service, Package, Medication) rendered after the name. */
  badge?: React.ReactNode;
  /** Secondary origin line under the name (e.g. parent package or template type). */
  origin?: string;
  /** Right-aligned price / stock / status meta. */
  meta?: React.ReactNode;
  disabled?: boolean;
  /** Shown (and used as the tooltip) when the row is disabled. */
  disabledReason?: string;
};

const DEFAULT_LEADING_ICON = <LuPlus aria-hidden="true" className="shrink-0" />;

/**
 * Shared result row for every workspace search bar so they share one structure:
 * leading icon, name (+ optional origin), source/kind badge, and price/stock/
 * status meta — with a consistent disabled state and reason. Callers map their
 * matches to this row and supply only the slots they have.
 */
const WorkspaceSearchResultRow = ({
  name,
  onSelect,
  leadingIcon = DEFAULT_LEADING_ICON,
  badge,
  origin,
  meta,
  disabled = false,
  disabledReason,
}: WorkspaceSearchResultRowProps) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className="flex w-full items-center gap-2 px-4 py-2 text-left text-body-4 text-text-primary hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {leadingIcon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{name}</span>
        {origin ? (
          <span className="truncate text-caption-2 text-text-secondary">{origin}</span>
        ) : null}
      </span>
      {disabled && disabledReason ? (
        <span className="shrink-0 text-caption-2 text-text-secondary">{disabledReason}</span>
      ) : null}
      {badge ? <span className="shrink-0">{badge}</span> : null}
      {meta ? <span className="shrink-0 text-text-secondary">{meta}</span> : null}
    </button>
  </li>
);

export default WorkspaceSearchResultRow;
