'use client';
import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FilterOption, StatusOption } from '@/app/features/companions/pages/Companions/types';
import clsx from 'clsx';
import { Primary } from '@/app/ui/primitives/Buttons';
import { IoAdd, IoChevronDown, IoWarning } from 'react-icons/io5';
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
      : 'border-[var(--hairline)]! text-[var(--danger-text)]! font-semibold hover:border-[var(--danger-border)]!';
  }
  return isActive
    ? 'bg-[var(--inset)] border-[var(--divider)]! text-[var(--ink)]! font-bold'
    : 'border-[var(--hairline)]! text-[var(--ink-muted)]! font-semibold hover:border-[var(--divider)]!';
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

  useEffect(() => {
    if (!open) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleClose);
    globalThis.window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClose);
      globalThis.window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open]);

  return (
    <div
      className={clsx(
        'flex items-center flex-wrap gap-2',
        hasFilterOptions ? 'w-full justify-between' : 'w-auto justify-end',
        className
      )}
    >
      {/* Left: filter pills (All / Emergencies) */}
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
                  'relative inline-flex items-center justify-center gap-1.5 rounded-full! border text-[12px] transition-colors',
                  compactFilterPills ? 'px-3 py-1' : 'px-[13px] py-1.5',
                  getFilterChipClassName(filter.key, activeFilter ?? '')
                )}
              >
                {isEmergency && (
                  <IoWarning
                    size={14}
                    aria-hidden="true"
                    className="shrink-0"
                    color="var(--danger-text)"
                  />
                )}
                <span>{filter.name}</span>
                {isEmergency && hasEmergency && (
                  <span
                    aria-label="Emergency appointments present"
                    className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--danger)',
                      outline: '2px solid var(--screen)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Right: status dropdown + add */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {statusOptions && statusOptions.length > 0 && (
          <>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full! border border-[var(--hairline)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-muted)] transition-colors"
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
                  {statusOptions.map((status) => {
                    const isActive = status.key === activeStatus;
                    return (
                      <button
                        key={status.key}
                        type="button"
                        onClick={() => {
                          setActiveStatus?.(status.key);
                          setOpen(false);
                        }}
                        className={clsx(
                          'w-full flex items-center gap-2.5 px-3 py-2.5 text-body-4 text-left transition-colors',
                          isActive && status.key !== 'all' ? 'font-medium' : 'hover:bg-card-hover'
                        )}
                      >
                        {status.border && (
                          <span
                            className="inline-block size-3 rounded-full shrink-0"
                            style={{
                              backgroundColor: status.border,
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: status.border,
                            }}
                          />
                        )}
                        <span style={{ color: getDropdownStatusTextColor(status) }}>
                          {status.name}
                        </span>
                        {isActive && (
                          <span
                            className="ml-auto text-sm font-semibold"
                            style={{ color: getDropdownStatusTextColor(status) }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
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
