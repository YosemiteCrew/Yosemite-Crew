'use client';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCaretDown } from 'react-icons/fa6';
import clsx from 'clsx';
import { InventoryFiltersState } from '@/app/features/inventory/pages/Inventory/types';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';

type StockHealthOption = {
  key: string;
  name: string;
  bg: string;
  text: string;
  border: string;
};

const StockHealthOptions: StockHealthOption[] = [
  {
    name: 'All',
    key: 'ALL',
    bg: 'var(--color-badge-blue-bg)',
    text: 'var(--color-badge-blue-text)',
    border: 'var(--color-primary-500)',
  },
  {
    name: 'Healthy',
    key: 'HEALTHY',
    bg: 'var(--color-pill-success-bg)',
    text: 'var(--color-pill-success-text)',
    border: 'var(--color-pill-success-border)',
  },
  {
    name: 'Low stock',
    key: 'LOW_STOCK',
    bg: 'var(--color-pill-progress-bg)',
    text: 'var(--color-pill-progress-text)',
    border: 'var(--color-pill-progress-border)',
  },
  {
    name: 'Expiring soon',
    key: 'EXPIRING_SOON',
    bg: 'var(--color-pill-info-bg)',
    text: 'var(--color-pill-info-text)',
    border: 'var(--color-pill-info-border)',
  },
  {
    name: 'Expired',
    key: 'EXPIRED',
    bg: 'var(--color-pill-warning-bg)',
    text: 'var(--color-pill-warning-text)',
    border: 'var(--color-pill-warning-border)',
  },
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

const getStockHealthButtonStyle = (option: StockHealthOption): React.CSSProperties => {
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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [isMounted, setIsMounted] = useState(false);
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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (filters.category !== 'all' && !categories.includes(filters.category)) {
      onChange({ ...filters, category: 'all' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const updateFilters = (patch: Partial<InventoryFiltersState>) => {
    onChange({ ...filters, ...patch });
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

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return;
      setDropdownOpen(false);
    };
    const handleScroll = () => setDropdownOpen(false);
    document.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [dropdownOpen]);

  const selectedStockHealth =
    StockHealthOptions.find((o) => o.key === filters.status) ?? StockHealthOptions[0];

  const visibility = filters.visibility ?? 'ALL';

  const sliderTranslate = getSliderTranslate(visibility);

  return (
    <div className="w-full flex items-start justify-between flex-wrap gap-x-6 gap-y-3">
      <div className="flex flex-1 min-w-70 items-center gap-3 flex-wrap">
        {/* Visibility toggle: All / Active / Hidden */}
        <div
          className="relative inline-flex items-center h-12 rounded-[999px]! border border-card-border bg-white overflow-hidden"
          style={{ width: 240 }}
        >
          <div
            aria-hidden
            className={clsx(
              'absolute top-0 bottom-0 left-0 rounded-[999px]! transition-all duration-300 ease-in-out',
              sliderTranslate
            )}
            style={{ width: 'calc(100% / 3)', backgroundColor: '#454341' }}
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
                  color: isCurrent ? '#FFF' : '#8F8984',
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
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex h-12 items-center gap-2 px-3 rounded-2xl! transition-all duration-300 text-body-4 justify-between min-w-30"
          style={getStockHealthButtonStyle(selectedStockHealth)}
        >
          <span>
            {selectedStockHealth.key === 'ALL' ? 'Stock health' : selectedStockHealth.name}
          </span>
          <FaCaretDown
            size={14}
            className={clsx('shrink-0 transition-transform', dropdownOpen && 'rotate-180')}
          />
        </button>

        {isMounted &&
          dropdownOpen &&
          createPortal(
            <div
              ref={panelRef}
              className="rounded-2xl border border-card-border bg-white shadow-[0_8px_24px_rgba(0,0,0,0.10)] overflow-hidden"
              style={dropdownStyle}
            >
              {StockHealthOptions.map((option) => {
                const isSelected = option.key === filters.status;
                const dropdownTextColor =
                  option.key === 'ALL' ? 'var(--color-text-primary)' : option.text;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      updateFilters({ status: option.key });
                      setDropdownOpen(false);
                    }}
                    className={clsx(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 text-body-4 text-left transition-colors',
                      isSelected && option.key !== 'ALL' ? 'font-medium' : 'hover:bg-card-hover'
                    )}
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: option.border,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: option.border,
                      }}
                    />
                    <span style={{ color: dropdownTextColor }}>{option.name}</span>
                    {isSelected && (
                      <span
                        className="ml-auto text-sm font-semibold"
                        style={{ color: dropdownTextColor }}
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
