'use client';
import FilterChip from '@/app/ui/filters/FilterChip';
import React from 'react';
import clsx from 'clsx';
import { IoAdd } from 'react-icons/io5';
import { FilterOption, StatusOption } from '@/app/features/companions/pages/Companions/types';
import { Primary } from '@/app/ui/primitives/Buttons';

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
            /* Was an ALL-CAPS StatusPill wrapped in a button, with the selected
               one marked by a focus-style ring. FilterChip's own doc says it
               "replaces the ALL-CAPS status pills that Templates and Finance
               used as filters, which made a filter row read as a row of
               statuses" - Finance and Templates moved, the task board did not,
               so the same interaction looked like two different controls. The
               status colour survives as the chip's leading dot. */
            <FilterChip
              key={option.key}
              label={option.name}
              active={isActive}
              onClick={() => toggleStatus(option.key)}
              dotColor={option.text ?? option.bg ?? 'var(--color-pill-neutral-text)'}
            />
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
