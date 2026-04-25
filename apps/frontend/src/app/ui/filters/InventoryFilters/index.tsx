import React, { useEffect, useMemo } from 'react';
import { InventoryFiltersState } from '@/app/features/inventory/pages/Inventory/types';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';

// Colors match getStatusBadgeStyle in utils.ts for consistency with table badges
const Statuses = [
  {
    name: 'All',
    key: 'ALL',
    bg: 'var(--color-badge-blue-bg)',
    text: 'var(--color-badge-blue-text)',
    border: 'var(--color-primary-500)',
  },
  {
    name: 'Active',
    key: 'ACTIVE',
    bg: 'var(--color-pill-success-bg)',
    text: 'var(--color-pill-success-text)',
    border: 'var(--color-pill-success-border)',
  },
  {
    name: 'Hidden',
    key: 'HIDDEN',
    bg: 'var(--color-pill-neutral-bg)',
    text: 'var(--color-pill-neutral-text)',
    border: 'var(--color-pill-neutral-border)',
  },
  {
    name: 'Low stock',
    key: 'LOW_STOCK',
    bg: 'var(--color-pill-progress-bg)',
    text: 'var(--color-pill-progress-text)',
    border: 'var(--color-pill-progress-border)',
  },
  {
    name: 'Expired',
    key: 'EXPIRED',
    bg: 'var(--color-pill-warning-bg)',
    text: 'var(--color-pill-warning-text)',
    border: 'var(--color-pill-warning-border)',
  },
  {
    name: 'Expiring soon',
    key: 'EXPIRING_SOON',
    bg: 'var(--color-pill-info-bg)',
    text: 'var(--color-pill-info-text)',
    border: 'var(--color-pill-info-border)',
  },
  {
    name: 'Healthy',
    key: 'HEALTHY',
    bg: 'var(--color-pill-success-bg)',
    text: 'var(--color-pill-success-text)',
    border: 'var(--color-pill-success-border)',
  },
];

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
  const categoryOptions = useMemo(
    () =>
      ['all', ...categories].map((cat) => ({
        label: cat === 'all' ? 'All categories' : cat,
        value: cat,
      })),
    [categories]
  );

  useEffect(() => {
    if (filters.category !== 'all' && !categories.includes(filters.category)) {
      onChange({ ...filters, category: 'all' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const updateFilters = (patch: Partial<InventoryFiltersState>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="w-full flex items-start justify-between flex-wrap gap-x-6 gap-y-3">
      <div className="flex flex-1 min-w-[280px] items-center gap-2 flex-wrap">
        {Statuses.map((status) => {
          const isActive = status.key === filters.status;
          return (
            <button
              key={status.key}
              disabled={loading}
              onClick={() => updateFilters({ status: status.key })}
              className={`min-w-20 text-body-4 px-3 py-1.5 rounded-2xl! border! transition-all duration-300 hover:bg-card-hover text-text-tertiary${isActive ? '' : ' border-card-border! hover:border-card-hover!'}`}
              style={
                isActive
                  ? {
                      backgroundColor: status.bg,
                      color: status.text,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: status.border,
                    }
                  : undefined
              }
            >
              {status.name}
            </button>
          );
        })}
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
