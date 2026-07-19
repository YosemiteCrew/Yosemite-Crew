'use client';
import React from 'react';
import clsx from 'clsx';
import { Option } from '@/app/features/companions/types/companion';
import { TaskAudience } from '@/app/features/tasks/constants/taskTaxonomy';

/**
 * "Assign to" chip row from the New task design: selectable team-member chips
 * (violet monogram avatar) plus pet-parent chips (pink dot). Picking a team chip
 * assigns to the team member (employee task); picking a pet-parent chip flips the
 * task to a parent task assigned to that pet parent. Replaces the plain
 * audience + assignee dropdowns in the modal.
 */
type TaskAssigneeChipsProps = {
  teamOptions: Option[];
  parentOptions: Option[];
  audience: TaskAudience;
  assignedTo: string;
  onSelectTeam?: (option: Option) => void;
  onSelectParent?: (option: Option) => void;
  error?: string;
};

const getInitials = (label: string): string =>
  label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '--';

const TaskAssigneeChips = ({
  teamOptions,
  parentOptions,
  audience,
  assignedTo,
  onSelectTeam,
  onSelectParent,
  error,
}: TaskAssigneeChipsProps) => {
  const hasOptions = teamOptions.length > 0 || parentOptions.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-[var(--ink-soft)]">Assign to</span>
      {hasOptions ? (
        <div className="flex flex-wrap gap-2">
          {teamOptions.map((option) => {
            const isActive = audience === 'EMPLOYEE_TASK' && assignedTo === option.value;
            return (
              <button
                key={`team-${option.value}`}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectTeam?.(option)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[12.5px] transition-colors',
                  isActive
                    ? 'border-[1.5px] border-[var(--blue)] bg-[var(--nav-active-bg)] font-bold text-[var(--nav-active)]'
                    : 'border border-[var(--hairline)] font-semibold text-[var(--ink-muted)] hover:bg-card-hover'
                )}
              >
                <span className="flex size-[26px] items-center justify-center rounded-full bg-[var(--avatar-violet-bg)] text-[10px] font-bold text-[var(--avatar-violet-ink)]">
                  {getInitials(option.label)}
                </span>
                {option.label}
              </button>
            );
          })}
          {parentOptions.map((option) => {
            const isActive = audience === 'PARENT_TASK' && assignedTo === option.value;
            return (
              <button
                key={`parent-${option.value}`}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectParent?.(option)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full px-3 py-2 text-[12.5px] transition-colors',
                  isActive
                    ? 'border-[1.5px] border-[var(--pink)] bg-[var(--nav-active-bg)] font-bold text-[var(--ink)]'
                    : 'border border-[var(--hairline)] font-semibold text-[var(--ink-muted)] hover:bg-card-hover'
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--pink)' }}
                />
                Pet parent · {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <span className="text-[12.5px] text-[var(--ink-faint)]">No assignees available yet.</span>
      )}
      {error && <span className="text-[12px] text-text-error">{error}</span>}
    </div>
  );
};

export default TaskAssigneeChips;
