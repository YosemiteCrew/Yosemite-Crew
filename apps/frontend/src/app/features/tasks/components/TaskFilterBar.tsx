'use client';
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
            <div
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
                        ? 'bg-[var(--inset)] font-bold text-[var(--ink)]'
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
            <button
              key={option.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => toggleFilter(option.key)}
              className={clsx(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-3.5 text-[12px] transition-colors',
                isActive
                  ? 'border-[var(--divider)] bg-[var(--inset)] font-bold text-[var(--ink)]'
                  : 'border-[var(--hairline)] font-semibold text-[var(--ink-muted)] hover:bg-card-hover'
              )}
            >
              {isParent && (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--pink)' }}
                />
              )}
              {option.name}
            </button>
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
                !isActive && 'opacity-65 transition-opacity hover:opacity-100'
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
          className="h-10 w-fit justify-center gap-2 px-4 py-0 whitespace-nowrap hover:scale-100"
        />
      )}
    </div>
  );
};

export default TaskFilterBar;
