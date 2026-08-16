'use client';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoCaretDown } from 'react-icons/io5';
import clsx from 'clsx';
import { statusLabel, type StatusLabel } from '@/app/constants/status';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import StatusOptionButtons from '@/app/ui/filters/StatusOptionButtons';
import { useFilterDropdownDismiss } from '@/app/ui/filters/useFilterDropdownDismiss';

const STATUS_OPTIONS: StatusLabel[] = [
  statusLabel('All', 'ALL', 'color-badge-blue', 'var(--color-primary-500)'),
  statusLabel('Excellent', 'EXCELLENT', 'color-pill-success'),
  statusLabel('Healthy', 'HEALTHY', 'color-pill-success'),
  statusLabel('Moderate', 'MODERATE', 'color-pill-progress'),
  statusLabel('Low', 'LOW', 'color-pill-warning'),
  statusLabel('Out of stock', 'OUT OF STOCK', 'color-pill-warning'),
];

const DEFAULT_CATEGORIES: string[] = [];

const getTurnoverDropdownTextColor = (option: StatusLabel): string =>
  option.key === 'ALL' ? 'var(--color-text-primary)' : option.text;

const getTurnoverStatusButtonStyle = (option: StatusLabel): React.CSSProperties => {
  if (option.key === 'ALL') {
    return {
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'var(--color-card-border)',
      color: 'var(--color-text-tertiary)',
    };
  }
  return {
    backgroundColor: option.bg,
    color: option.text,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: option.border,
  };
};

type InventoryTurnoverFiltersProps = {
  filters: InventoryTurnoverFilterState;
  setFilters: React.Dispatch<React.SetStateAction<InventoryTurnoverFilterState>>;
  categories?: string[];
};

export type InventoryTurnoverFilterState = {
  status: string;
  category: string;
};

const InventoryTurnoverFilters = ({
  filters,
  setFilters,
  categories = DEFAULT_CATEGORIES,
}: InventoryTurnoverFiltersProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const isMounted = typeof document !== 'undefined';
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const categoryOptions = useMemo(
    () =>
      ['all', ...categories].map((cat) => ({
        label: cat === 'all' ? 'All categories' : cat,
        value: cat,
      })),
    [categories]
  );

  const effectiveCategory =
    filters.category !== 'all' && !categories.includes(filters.category) ? 'all' : filters.category;

  const setActiveStatus = (status: string) => {
    setFilters((current) => ({ ...current, status }));
  };

  const setActiveCategory = (category: string) => {
    setFilters((current) => ({ ...current, category }));
  };

  const positionPanel = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, 180),
      zIndex: 9999,
    });
  }, []);

  useLayoutEffect(() => {
    if (dropdownOpen) positionPanel();
  }, [dropdownOpen, positionPanel]);

  useFilterDropdownDismiss(dropdownOpen, setDropdownOpen, triggerRef, panelRef);

  const selectedStatus = STATUS_OPTIONS.find((o) => o.key === filters.status) ?? STATUS_OPTIONS[0];

  return (
    <div className="w-full flex items-start justify-between flex-wrap gap-x-6 gap-y-3">
      <div className="flex flex-1 min-w-70 items-center gap-2 flex-wrap">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex h-10 items-center gap-2 px-3 rounded-2xl! transition-all duration-300 text-[13px] justify-between min-w-30"
          style={getTurnoverStatusButtonStyle(selectedStatus)}
        >
          <span>{selectedStatus.key === 'ALL' ? 'Status' : selectedStatus.name}</span>
          <IoCaretDown
            size={14}
            className={clsx('shrink-0 transition-transform', dropdownOpen && 'rotate-180')}
          />
        </button>

        {isMounted &&
          dropdownOpen &&
          createPortal(
            <div
              ref={panelRef}
              className="yc-glass-overlay rounded-2xl overflow-hidden"
              style={dropdownStyle}
            >
              <StatusOptionButtons
                options={STATUS_OPTIONS}
                activeKey={filters.status}
                allKey="ALL"
                onSelect={(key) => {
                  setActiveStatus(key);
                  setDropdownOpen(false);
                }}
                getTextColor={getTurnoverDropdownTextColor}
              />
            </div>,
            document.body
          )}
      </div>

      <div className="w-full sm:w-55 min-w-45 shrink-0">
        <LabelDropdown
          placeholder="Category"
          options={categoryOptions}
          defaultOption={effectiveCategory}
          onSelect={(option) => setActiveCategory(option.value)}
        />
      </div>
    </div>
  );
};

export default InventoryTurnoverFilters;
