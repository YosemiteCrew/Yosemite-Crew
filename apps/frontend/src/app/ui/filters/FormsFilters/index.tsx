'use client';
import {
  FormsStatusFilters,
  getFormCategoryDisplayLabel,
  getFormCategoryOptionsForOrgType,
} from '@/app/features/forms/types/forms';
import type { FormsCategory, FormsStatus } from '@/app/features/forms/types/forms';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoChevronDown } from 'react-icons/io5';
import clsx from 'clsx';
import { useOrgStore } from '@/app/stores/orgStore';
import { Organisation } from '@yosemite-crew/types';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { getFormsStatusTone } from '@/app/ui/tables/tableUtils';

export type FormsFilterState = {
  status: FormsStatus | 'All';
  category: FormsCategory | 'All';
};

type FormsFiltersProps = {
  filters: FormsFilterState;
  onFiltersChange: (filters: FormsFilterState) => void;
  categoryAction?: React.ReactNode;
};

const getStatusFilterStyle = (
  status: FormsStatus | 'All',
  isActive: boolean
): React.CSSProperties | undefined => {
  if (!isActive) {
    return {
      backgroundColor: 'transparent',
      borderColor: 'var(--hairline)',
      color: 'var(--ink-muted)',
      fontWeight: 600,
    };
  }
  if (status === 'All') {
    return {
      backgroundColor: 'var(--inset)',
      borderColor: 'var(--divider)',
      color: 'var(--ink)',
      fontWeight: 700,
    };
  }
  return undefined;
};

const FormsFilters = ({ filters, onFiltersChange, categoryAction }: FormsFiltersProps) => {
  const orgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE as
    Organisation['type'] | undefined;
  const effectiveOrgType = orgTypeOverride || orgType;

  const categoryOptions = useMemo(() => {
    const allowed = getFormCategoryOptionsForOrgType(effectiveOrgType);

    return ['All', ...allowed].map((cat) => ({
      label: cat === 'All' ? 'All categories' : getFormCategoryDisplayLabel(cat, effectiveOrgType),
      value: cat,
    }));
  }, [effectiveOrgType]);

  const allowedCategoryValues = useMemo(
    () => new Set(categoryOptions.map((opt) => opt.value)),
    [categoryOptions]
  );
  const effectiveCategory = allowedCategoryValues.has(filters.category) ? filters.category : 'All';
  const selectedCategoryLabel =
    effectiveCategory === 'All'
      ? 'All categories'
      : getFormCategoryDisplayLabel(effectiveCategory, effectiveOrgType);

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMounted = typeof document !== 'undefined';

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
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open]);

  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | undefined>(undefined);

  // Measure the trigger in the click handler (not during render): the panel is
  // portaled to <body>, so it is positioned from the trigger's viewport rect.
  const toggleOpen = () => {
    const next = !open;
    if (next && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        right: globalThis.window.innerWidth - rect.right,
        minWidth: Math.max(rect.width, 200),
        zIndex: 9999,
      });
    }
    setOpen(next);
  };

  const selectCategory = (value: string) => {
    onFiltersChange({ ...filters, category: value as FormsCategory | 'All' });
    setOpen(false);
  };

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {FormsStatusFilters.map((status) => {
          const isActive = status === filters.status;
          return (
            <button
              type="button"
              key={status}
              onClick={() => onFiltersChange({ ...filters, status })}
              aria-pressed={isActive}
              className="inline-flex min-h-[38px] items-center justify-center rounded-full! bg-transparent px-1 py-1 transition-opacity hover:opacity-100"
            >
              <StatusPill
                tone={status === 'All' ? 'neutral' : getFormsStatusTone(status)}
                label={status}
                style={getStatusFilterStyle(status, isActive)}
              />
            </button>
          );
        })}
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
        {categoryAction}
        {/* Design separates the pill row from the trailing dropdown with an 18px hairline. */}
        <span
          aria-hidden="true"
          className="mx-1 shrink-0"
          style={{ width: '1px', height: '18px', backgroundColor: 'var(--hairline)' }}
        />
        <button
          ref={triggerRef}
          type="button"
          onClick={toggleOpen}
          // No aria-haspopup: the popup is a plain stack of buttons, not a
          // listbox or a menu, and it implements no keyboard model. aria-expanded
          // plus the label below already say what this control does.
          aria-expanded={open}
          aria-label={`Category: ${selectedCategoryLabel}`}
          className="inline-flex items-center gap-1.5 rounded-full! border border-[var(--hairline)] px-[13px] py-1.5 text-[12px] font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--divider)]"
        >
          <span className="truncate">{selectedCategoryLabel}</span>
          <IoChevronDown
            size={12}
            aria-hidden="true"
            className={clsx('shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>
        {isMounted &&
          open &&
          createPortal(
            <div
              ref={panelRef}
              aria-label="Category"
              data-testid="category-menu"
              className="yc-glass-overlay rounded-2xl max-h-64 overflow-y-auto py-1"
              style={panelStyle}
            >
              {categoryOptions.map((opt) => {
                const isSelected = opt.value === effectiveCategory;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    // Single-select, so these are plain buttons per AGENTS.md, not
                    // toggles: aria-pressed would expose eight independent
                    // switches. aria-current marks the chosen one within the set
                    // without claiming a listbox or menu widget.
                    aria-current={isSelected ? 'true' : undefined}
                    data-testid={`option-${opt.value}`}
                    onClick={() => selectCategory(opt.value)}
                    className={clsx(
                      'flex w-full items-center justify-between gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors',
                      isSelected
                        ? 'bg-[var(--inset)] font-semibold text-[var(--ink)]'
                        : 'text-[var(--ink-muted)] hover:bg-[var(--inset)]'
                    )}
                  >
                    <span className="min-w-0 truncate">{opt.label}</span>
                    {isSelected && <span aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};

export default FormsFilters;
