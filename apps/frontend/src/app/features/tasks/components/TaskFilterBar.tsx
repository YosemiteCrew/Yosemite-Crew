'use client';
import FilterChip from '@/app/ui/filters/FilterChip';
import React from 'react';
import clsx from 'clsx';
import { IoAdd } from 'react-icons/io5';
import { FilterOption, StatusOption } from '@/app/features/companions/pages/Companions/types';
import { Primary } from '@/app/ui/primitives/Buttons';
import StatusPill, { type StatusPillTokens } from '@/app/ui/primitives/StatusPill/StatusPill';

/**
 * Task filter row rebuilt to the design: fully-rounded audience pills (All /
 * Team / Pet parents, the parent pill carrying a pink dot), a vertical hairline
 * divider, then inline status pills (Pending / In progress / Completed /
 * Cancelled) instead of the shared "All statuses" dropdown. Area-local so the
 * shared Filters dropdown pattern stays untouched for the other modules.
 */
type ScopeOption = { key: string; name: string };

type TaskFilterBarProps = {
  filterOptions: FilterOption[];
  statusOptions: StatusOption[];
  scopeOptions?: ScopeOption[];
  activeFilter: string;
  activeStatus: string;
  activeScope?: string;
  setActiveFilter: (value: string) => void;
  setActiveStatus: (value: string) => void;
  setActiveScope?: (value: string) => void;
  showAddButton?: boolean;
  onAddButtonClick?: () => void;
  addButtonText?: string;
};

const PARENT_AUDIENCE_KEY = 'parent_task';

const getStatusPillTokens = (option: StatusOption): StatusPillTokens => ({
  bg: option.bg ?? 'var(--color-pill-neutral-bg)',
  text: option.text ?? 'var(--color-pill-neutral-text)',
  border: option.border ?? option.bg ?? 'var(--color-pill-neutral-border)',
});

const TaskFilterBar = ({
  filterOptions,
  statusOptions,
  scopeOptions,
  activeFilter,
  activeStatus,
  activeScope,
  setActiveFilter,
  setActiveStatus,
  setActiveScope,
  showAddButton = false,
  onAddButtonClick,
  addButtonText = 'New task',
}: TaskFilterBarProps) => {
  const statusPills = statusOptions.filter((option) => option.key.toLowerCase() !== 'all');
  const showScope = !!scopeOptions && scopeOptions.length > 0 && !!setActiveScope;

  const toggleFilter = (key: string) => setActiveFilter(activeFilter === key ? 'all' : key);
  const toggleStatus = (key: string) => setActiveStatus(activeStatus === key ? 'all' : key);

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {showScope && (
          <>
            <div /* NOSONAR: styled inline-flex segmented control; native <fieldset> defaults (block layout, border, required legend) break the pill design */
              role="group"
              aria-label="Task scope"
              className="inline-flex items-center rounded-full border border-[var(--hairline)] p-0.5"
            >
              {scopeOptions.map((option) => {
                const isActive = activeScope === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveScope(option.key)}
                    className={clsx(
                      'inline-flex h-6 items-center rounded-full px-3 text-[12px] transition-colors',
                      isActive
                        ? 'bg-[var(--chip-selected-bg)] font-bold text-[var(--chip-selected-ink)]'
                        : 'font-semibold text-[var(--ink-muted)] hover:bg-card-hover'
                    )}
                  >
                    {option.name}
                  </button>
                );
              })}
            </div>
            <span aria-hidden="true" className="mx-1 h-[18px] w-px shrink-0 bg-[var(--hairline)]" />
          </>
        )}

        {filterOptions.map((option) => {
          const isActive = activeFilter === option.key;
          const isParent = option.key === PARENT_AUDIENCE_KEY;
          return (
            /* Was a hand-rolled 28px chip with 14px padding and 12px type, drawn
               from the same --chip-selected-* tokens as the shared one but two
               sizes down from it. The task board's filters are the same control
               as Finance's and Guides'. */
            <FilterChip
              key={option.key}
              label={option.name}
              active={isActive}
              onClick={() => toggleFilter(option.key)}
              dotColor={isParent ? 'var(--pink)' : undefined}
            />
          );
        })}

        {statusPills.length > 0 && (
          <span aria-hidden="true" className="mx-1 h-[18px] w-px shrink-0 bg-[var(--hairline)]" />
        )}

        {statusPills.map((option) => {
          const isActive = activeStatus === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => toggleStatus(option.key)}
              className={clsx(
                'inline-flex min-h-[38px] items-center justify-center rounded-full px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand',
                // The selected filter needs a visible state of its own. It used
                // to be the ABSENCE of an opacity-65 dim on the others, which
                // meant the only way to see which filter was active was that the
                // rest were faded - and that dim composited their labels below
                // AA. A ring marks the selected one instead, so nothing has to
                // be made unreadable to show it.
                isActive &&
                  'ring-2 ring-[var(--blue-strong)] ring-offset-1 ring-offset-[var(--screen)]'
              )}
            >
              <StatusPill tokens={getStatusPillTokens(option)} label={option.name} />
            </button>
          );
        })}
      </div>

      {showAddButton && (
        <Primary
          text={addButtonText}
          onClick={onAddButtonClick}
          icon={<IoAdd size={18} aria-hidden="true" />}
          className="w-fit shrink-0 justify-center py-0 whitespace-nowrap hover:scale-100"
        />
      )}
    </div>
  );
};

export default TaskFilterBar;
