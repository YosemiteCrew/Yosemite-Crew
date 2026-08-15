'use client';
import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FilterOption, StatusOption } from '@/app/features/companions/pages/Companions/types';
import clsx from 'clsx';
import { Primary } from '@/app/ui/primitives/Buttons';
import { IoAdd, IoChevronDown } from 'react-icons/io5';
import StatusOptionButtons from '@/app/ui/filters/StatusOptionButtons';
import { useFilterDropdownDismiss } from '@/app/ui/filters/useFilterDropdownDismiss';
const getDropdownStatusTextColor = (status: StatusOption): string =>
  status.dropdownText ?? status.text ?? 'var(--color-text-primary)';

// Design filter-chip recipe (list toolbars): pill, 6px 13px, 12px text.
// Neutral: active = --inset fill + --divider border + --ink bold; rest = --hairline border + --ink-muted.
// Emergency: always danger-toned (--danger-border/--danger-text); active adds --danger-bg fill.
const getFilterChipClassName = (filterKey: string, activeFilter: string): string => {
  const isActive = filterKey === activeFilter;
  if (filterKey === 'emergencies') {
    return isActive
      ? 'bg-[var(--danger-bg)] border-[var(--danger-border)]! text-[var(--danger-text)]! font-bold'
      : 'border-[var(--danger-border)]! text-[var(--danger-text)]! font-semibold';
  }
  return isActive
    ? 'bg-[var(--inset)] border-[var(--divider)]! text-[var(--ink)]! font-bold'
    : 'border-[var(--hairline)]! text-[var(--ink-muted)]! font-semibold hover:border-[var(--divider)]!';
};

// Design status-pill recipe (list toolbar): same pill geometry as the filter chips.
// Active carries the status' own bg/border/text at weight 700 ("all" falls back to
// the neutral --inset/--divider/--ink recipe); the rest stay --hairline/--ink-muted.
// Tokens are applied inline so they keep following the live theme.
const getStatusPillStyle = (status: StatusOption, isActive: boolean): React.CSSProperties => {
  if (!isActive) {
    return { borderColor: 'var(--hairline)', color: 'var(--ink-muted)', fontWeight: 600 };
  }
  if (status.key.toLowerCase() === 'all') {
    return {
      backgroundColor: 'var(--inset)',
      borderColor: 'var(--divider)',
      color: 'var(--ink)',
      fontWeight: 700,
    };
  }
  return {
    backgroundColor: status.bg,
    borderColor: status.border ?? status.bg ?? 'var(--hairline)',
    color: status.text ?? 'var(--ink)',
    fontWeight: 700,
  };
};

type FiltersProps = {
  filterOptions?: FilterOption[];
  statusOptions?: StatusOption[];
  activeFilter?: string;
  setActiveFilter?: (v: string) => void;
  activeStatus?: string;
  setActiveStatus?: (v: string) => void;
  hasEmergency?: boolean;
  showAddButton?: boolean;
  onAddButtonClick?: () => void;
  addButtonText?: string;
  className?: string;
  compactFilterPills?: boolean;
};

const Filters = ({
  filterOptions,
  statusOptions,
  activeFilter,
  setActiveFilter,
  activeStatus,
  setActiveStatus,
  hasEmergency = false,
  showAddButton = false,
  onAddButtonClick,
  addButtonText = 'New appointment',
  className,
  compactFilterPills = false,
}: FiltersProps) => {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const isMounted = typeof document !== 'undefined';
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedStatus = statusOptions?.find((s) => s.key === activeStatus) ?? statusOptions?.[0];
  const hasFilterOptions = Boolean(filterOptions?.length);
  // List toolbars (the only place filter chips appear) surface the statuses as an
  // inline pill row; the standalone toolbars keep the compact "All statuses" dropdown.
  const showInlineStatusPills = hasFilterOptions && Boolean(statusOptions?.length);
  const isAllStatus = (selectedStatus?.key?.toLowerCase() ?? 'all') === 'all';
  const showStatusTint = !isAllStatus && Boolean(selectedStatus?.bg);
  const handleFilterToggle = (filterKey: string) => {
    if (!setActiveFilter) return;
    setActiveFilter(activeFilter === filterKey ? 'all' : filterKey);
  };

  const positionPanel = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      right: globalThis.window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, 180),
      zIndex: 9999,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) positionPanel();
  }, [open, positionPanel]);

  useFilterDropdownDismiss(open, setOpen, triggerRef, panelRef);

  return (
    <div
      className={clsx(
        'flex items-center flex-wrap gap-2',
        hasFilterOptions ? 'w-full justify-between' : 'w-auto justify-end',
        className
      )}
    >
      {/* Left: filter pills (All / Emergencies), then the inline status pill row */}
      {hasFilterOptions && (
        <div className="flex items-center gap-2 flex-wrap">
          {filterOptions?.map((filter) => {
            const isEmergency = filter.key === 'emergencies';
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => handleFilterToggle(filter.key)}
                className={clsx(
                  'inline-flex items-center justify-center gap-1.5 rounded-full! border text-[12px] transition-colors',
                  compactFilterPills ? 'px-3 py-1' : 'px-[13px] py-1.5',
                  getFilterChipClassName(filter.key, activeFilter ?? '')
                )}
              >
                {isEmergency && (
                  // 6px danger dot; it doubles as the "emergencies present" marker.
                  <span
                    aria-label={hasEmergency ? 'Emergency appointments present' : undefined}
                    aria-hidden={hasEmergency ? undefined : true}
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: 'var(--danger)' }}
                  />
                )}
                <span>{filter.name}</span>
              </button>
            );
          })}

          {showInlineStatusPills && (
            <>
              <span
                aria-hidden="true"
                className="mx-1 shrink-0"
                style={{ width: '1px', height: '18px', backgroundColor: 'var(--hairline)' }}
              />
              {statusOptions?.map((status) => {
                const isActive = status.key === selectedStatus?.key;
                return (
                  <button
                    key={status.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveStatus?.(status.key)}
                    className="inline-flex items-center justify-center rounded-full! border px-[13px] py-1.5 text-[12px] transition-colors"
                    style={getStatusPillStyle(status, isActive)}
                  >
                    {status.name}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Right: status dropdown + add */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {!showInlineStatusPills && statusOptions && statusOptions.length > 0 && (
          <>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full! border border-[var(--hairline)] px-[11px] py-1.5 text-[11px] font-semibold text-[var(--ink-muted)] transition-colors"
              style={
                showStatusTint
                  ? {
                      backgroundColor: selectedStatus?.bg,
                      color: selectedStatus?.text ?? 'var(--color-black-pure)',
                      borderColor: selectedStatus?.border ?? selectedStatus?.bg,
                    }
                  : undefined
              }
            >
              <span>{isAllStatus ? 'All statuses' : (selectedStatus?.name ?? 'All statuses')}</span>
              <IoChevronDown
                size={12}
                className={clsx('shrink-0 transition-transform', open && 'rotate-180')}
              />
            </button>

            {isMounted &&
              open &&
              createPortal(
                <div
                  ref={panelRef}
                  className="yc-glass-overlay rounded-2xl overflow-hidden"
                  style={dropdownStyle}
                >
                  <StatusOptionButtons
                    options={statusOptions}
                    activeKey={activeStatus}
                    allKey="all"
                    onSelect={(key) => {
                      setActiveStatus?.(key);
                      setOpen(false);
                    }}
                    getTextColor={getDropdownStatusTextColor}
                  />
                </div>,
                document.body
              )}
          </>
        )}
        {showAddButton && (
          <Primary
            text={addButtonText}
            onClick={onAddButtonClick}
            icon={<IoAdd size={18} aria-hidden="true" />}
            className="h-12 w-fit justify-center gap-2 px-4 py-0 whitespace-nowrap hover:scale-100"
          />
        )}
      </div>
    </div>
  );
};

export default Filters;
