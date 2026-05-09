'use client';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCaretDown } from 'react-icons/fa6';
import clsx from 'clsx';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { InventoryTurnoverItem } from '@/app/features/inventory/pages/Inventory/types';

const STATUS_OPTIONS = [
  {
    name: 'All',
    key: 'ALL',
    bg: 'var(--color-badge-blue-bg)',
    text: 'var(--color-badge-blue-text)',
    border: 'var(--color-primary-500)',
  },
  {
    name: 'Excellent',
    key: 'EXCELLENT',
    bg: 'var(--color-pill-success-bg)',
    text: 'var(--color-pill-success-text)',
    border: 'var(--color-pill-success-border)',
  },
  {
    name: 'Healthy',
    key: 'HEALTHY',
    bg: 'var(--color-pill-success-bg)',
    text: 'var(--color-pill-success-text)',
    border: 'var(--color-pill-success-border)',
  },
  {
    name: 'Moderate',
    key: 'MODERATE',
    bg: 'var(--color-pill-progress-bg)',
    text: 'var(--color-pill-progress-text)',
    border: 'var(--color-pill-progress-border)',
  },
  {
    name: 'Low',
    key: 'LOW',
    bg: 'var(--color-pill-warning-bg)',
    text: 'var(--color-pill-warning-text)',
    border: 'var(--color-pill-warning-border)',
  },
  {
    name: 'Out of stock',
    key: 'OUT OF STOCK',
    bg: 'var(--color-pill-warning-bg)',
    text: 'var(--color-pill-warning-text)',
    border: 'var(--color-pill-warning-border)',
  },
];

const getTurnoverStatusButtonStyle = (
  option: (typeof STATUS_OPTIONS)[number]
): React.CSSProperties => {
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
  list: InventoryTurnoverItem[];
  setFilteredList: (items: InventoryTurnoverItem[]) => void;
  categories?: string[];
};

const InventoryTurnoverFilters = ({
  list,
  setFilteredList,
  categories = [],
}: InventoryTurnoverFiltersProps) => {
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [activeCategory, setActiveCategory] = useState('all');
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
    if (activeCategory !== 'all' && !categories.includes(activeCategory)) {
      setActiveCategory('all');
    }
  }, [activeCategory, categories]);

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const categoryMatch =
        activeCategory === 'all' ||
        (item.category || '').toLowerCase() === activeCategory.toLowerCase();
      const statusMatch =
        activeStatus === 'ALL' || (item.status || '').toUpperCase() === activeStatus;
      return categoryMatch && statusMatch;
    });
  }, [activeCategory, activeStatus, list]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

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

  const selectedStatus = STATUS_OPTIONS.find((o) => o.key === activeStatus) ?? STATUS_OPTIONS[0];

  return (
    <div className="w-full flex items-start justify-between flex-wrap gap-x-6 gap-y-3">
      <div className="flex flex-1 min-w-70 items-center gap-2 flex-wrap">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex h-12 items-center gap-2 px-3 rounded-2xl! transition-all duration-300 text-body-4 justify-between min-w-30"
          style={getTurnoverStatusButtonStyle(selectedStatus)}
        >
          <span>{selectedStatus.key === 'ALL' ? 'Status' : selectedStatus.name}</span>
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
              {STATUS_OPTIONS.map((option) => {
                const isSelected = option.key === activeStatus;
                const dropdownTextColor =
                  option.key === 'ALL' ? 'var(--color-text-primary)' : option.text;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setActiveStatus(option.key);
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

      <div className="w-full sm:w-55 min-w-45 shrink-0">
        <LabelDropdown
          placeholder="Category"
          options={categoryOptions}
          defaultOption={activeCategory}
          onSelect={(option) => setActiveCategory(option.value)}
        />
      </div>
    </div>
  );
};

export default InventoryTurnoverFilters;
