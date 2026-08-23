'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoCaretDown } from 'react-icons/io5';
import clsx from 'clsx';
import { InventoryFiltersState } from '@/app/features/inventory/pages/Inventory/types';
import { statusLabel, type StatusLabel } from '@/app/constants/status';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import StatusOptionButtons from '@/app/ui/filters/StatusOptionButtons';
import { useFilterDropdownDismiss } from '@/app/ui/filters/useFilterDropdownDismiss';

const StockHealthOptions: StatusLabel[] = [
  statusLabel('All', 'ALL', 'color-badge-blue', 'var(--color-primary-500)'),
  statusLabel('Healthy', 'HEALTHY', 'color-pill-success'),
  statusLabel('Low stock', 'LOW_STOCK', 'color-pill-progress'),
  statusLabel('Expiring soon', 'EXPIRING_SOON', 'color-pill-info'),
  statusLabel('Expired', 'EXPIRED', 'color-pill-warning'),
];

const getSliderTranslate = (visibility: string): string => {
  if (visibility === 'ALL') return 'translate-x-0';
  if (visibility === 'ACTIVE') return 'translate-x-full';
  return 'translate-x-[200%]';
};

const getVisibilityLabel = (key: 'ALL' | 'ACTIVE' | 'HIDDEN'): string => {
  if (key === 'ALL') return 'All';
  if (key === 'ACTIVE') return 'Active';
  return 'Hidden';
};

const getStockHealthDropdownTextColor = (option: StatusLabel): string =>
  option.key === 'ALL' ? 'var(--color-text-primary)' : option.text;

const getStockHealthButtonStyle = (option: StatusLabel): React.CSSProperties => {
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

type InventoryFiltersProps = {
  filters: InventoryFiltersState;
  onChange: (filters: InventoryFiltersState) => void;
  categories: string[];
  loading?: boolean;
  categoryAction?: React.ReactNode;
};

const InventoryFilters = ({
  filters,
  onChange,
  categories,
  loading = false,
  categoryAction,
}: InventoryFiltersProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

  const updateFilters = (patch: Partial<InventoryFiltersState>) => {
    onChange({ ...filters, ...patch });
  };

  // The selected category can disappear from `categories` (an org type change,
  // a reload). Telling the parent from an effect rather than during render:
  // `onChange` sets state in the PARENT, and doing that while this component
  // renders is what React warns about - and re-renders in a loop if the parent
  // does not replace the value immediately.
  const categoryIsStale = filters.category !== 'all' && !categories.includes(filters.category);
  useEffect(() => {
    if (!categoryIsStale) return;
    onChange({ ...filters, category: 'all' });
  }, [categoryIsStale, filters, onChange]);

  useFilterDropdownDismiss(dropdownOpen, setDropdownOpen, triggerRef, panelRef);

  const selectedStockHealth =
    StockHealthOptions.find((o) => o.key === filters.status) ?? StockHealthOptions[0];

  const visibility = filters.visibility ?? 'ALL';

  const sliderTranslate = getSliderTranslate(visibility);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | undefined>(undefined);

  // Measure the trigger in the click handler (not during render): the panel is
  // portaled to <body>, so it is positioned from the trigger's viewport rect.
  const toggleDropdown = () => {
    const next = !dropdownOpen;
    if (next && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        right: globalThis.window.innerWidth - rect.right,
        minWidth: Math.max(rect.width, 180),
        zIndex: 9999,
      });
    }
    setDropdownOpen(next);
  };

  return (
    <div className="w-full flex items-start justify-between flex-wrap gap-x-6 gap-y-3">
      <div className="flex flex-1 min-w-70 items-center gap-3 flex-wrap">
        {/* Visibility toggle: All / Active / Hidden */}
        <div
          className="relative inline-flex items-center h-12 rounded-[999px]! border border-card-border bg-neutral-0 overflow-hidden"
          style={{ width: 240 }}
        >
          <div
            aria-hidden
            className={clsx(
              'absolute top-0 bottom-0 left-0 rounded-[999px]! transition-all duration-300 ease-in-out',
              sliderTranslate
            )}
            style={{ width: 'calc(100% / 3)', backgroundColor: 'var(--color-neutral-900)' }}
          />
          {(['ALL', 'ACTIVE', 'HIDDEN'] as const).map((key) => {
            const label = getVisibilityLabel(key);
            const isCurrent = visibility === key;
            return (
              <button
                key={key}
                type="button"
                disabled={loading}
                onClick={() => updateFilters({ visibility: key })}
                className="relative z-10 h-full transition-colors duration-200 cursor-pointer"
                style={{
                  width: 'calc(100% / 3)',
                  color: isCurrent ? 'var(--color-neutral-0)' : 'var(--color-text-tertiary)',
                  fontWeight: 500,
                  lineHeight: '120%',
                  letterSpacing: '-0.28px',
                  fontFamily: 'var(--font-satoshi)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Stock health dropdown pill */}
        <button
          ref={triggerRef}
          type="button"
          disabled={loading}
          onClick={toggleDropdown}
          className="flex h-10 items-center gap-2 px-3 rounded-2xl! transition-all duration-300 text-[13px] justify-between min-w-30"
          style={getStockHealthButtonStyle(selectedStockHealth)}
        >
          <span>
            {selectedStockHealth.key === 'ALL' ? 'Stock health' : selectedStockHealth.name}
          </span>
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
                options={StockHealthOptions}
                activeKey={filters.status}
                allKey="ALL"
                onSelect={(key) => {
                  updateFilters({ status: key });
                  setDropdownOpen(false);
                }}
                getTextColor={getStockHealthDropdownTextColor}
              />
            </div>,
            document.body
          )}
      </div>

      <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
        {categoryAction}
        <div className="w-full sm:w-55 min-w-45">
          <LabelDropdown
            placeholder="Category"
            options={categoryOptions}
            defaultOption={filters.category}
            onSelect={(option) => updateFilters({ category: option.value })}
          />
        </div>
      </div>
    </div>
  );
};

export default InventoryFilters;
