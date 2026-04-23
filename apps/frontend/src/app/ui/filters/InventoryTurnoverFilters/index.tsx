import React, { useEffect, useMemo, useState } from 'react';
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

  const categoryOptions = useMemo(
    () =>
      ['all', ...categories].map((cat) => ({
        label: cat === 'all' ? 'All categories' : cat,
        value: cat,
      })),
    [categories]
  );

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

  return (
    <div className="w-full flex items-start justify-between flex-wrap gap-x-6 gap-y-3">
      <div className="flex flex-1 min-w-[280px] items-center gap-2 flex-wrap">
        {STATUS_OPTIONS.map((status) => {
          const isActive = status.key === activeStatus;
          return (
            <button
              key={status.key}
              type="button"
              onClick={() => setActiveStatus(status.key)}
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
