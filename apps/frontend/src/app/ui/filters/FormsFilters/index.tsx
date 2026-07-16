import {
  FormsCategoryOptions,
  FormsStatusFilters,
  getFormCategoryDisplayLabel,
} from '@/app/features/forms/types/forms';
import type { FormsCategory, FormsStatus } from '@/app/features/forms/types/forms';
import React, { useMemo } from 'react';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { getFormsStatusStyle } from '@/app/ui/tables/tableUtils';
import { useOrgStore } from '@/app/stores/orgStore';
import { Organisation } from '@yosemite-crew/types';

export type FormsFilterState = {
  status: FormsStatus | 'All';
  category: FormsCategory | 'All';
};

type FormsFiltersProps = {
  filters: FormsFilterState;
  onFiltersChange: (filters: FormsFilterState) => void;
  categoryAction?: React.ReactNode;
};

const FormsFilters = ({ filters, onFiltersChange, categoryAction }: FormsFiltersProps) => {
  const orgType = useOrgStore((s) =>
    s.primaryOrgId ? s.orgsById[s.primaryOrgId]?.type : undefined
  );
  const orgTypeOverride = process.env.NEXT_PUBLIC_ORG_TYPE_OVERRIDE as
    Organisation['type'] | undefined;
  const effectiveOrgType = orgTypeOverride || orgType;

  const filteredCategoryOptions = useMemo(() => {
    const base = new Set(['Consent form', 'Discharge', 'Prescription', 'Custom']);
    const allowed = (() => {
      if (effectiveOrgType === 'HOSPITAL') {
        return FormsCategoryOptions.filter((c) => base.has(c));
      }
      if (effectiveOrgType === 'BOARDER') {
        return FormsCategoryOptions.filter((c) => base.has(c) || c.startsWith('Boarder'));
      }
      if (effectiveOrgType === 'BREEDER') {
        return FormsCategoryOptions.filter((c) => base.has(c) || c.startsWith('Breeder'));
      }
      if (effectiveOrgType === 'GROOMER') {
        return FormsCategoryOptions.filter((c) => base.has(c) || c.startsWith('Groomer'));
      }
      return FormsCategoryOptions;
    })();

    return ['All', ...allowed].map((cat) => ({
      label: cat === 'All' ? cat : getFormCategoryDisplayLabel(cat, effectiveOrgType),
      value: cat,
    }));
  }, [effectiveOrgType]);

  const allowedCategoryValues = useMemo(
    () => new Set(filteredCategoryOptions.map((opt) => opt.value)),
    [filteredCategoryOptions]
  );
  const effectiveCategory = allowedCategoryValues.has(filters.category) ? filters.category : 'All';

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {FormsStatusFilters.map((status) => {
          const isActive = status === filters.status;
          const statusStyle =
            status === 'All'
              ? {
                  color: 'var(--color-badge-blue-text)',
                  backgroundColor: 'var(--color-badge-blue-bg)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--color-primary-500)',
                }
              : getFormsStatusStyle(status || '');

          return (
            <button
              type="button"
              key={status}
              onClick={() => onFiltersChange({ ...filters, status })}
              className={`min-w-20 text-body-4 px-3 py-1.5 rounded-2xl! border! transition-all duration-300 hover:bg-card-hover text-text-tertiary${isActive ? '' : ' border-card-border! hover:border-card-hover!'}`}
              style={isActive ? statusStyle : undefined}
            >
              {status}
            </button>
          );
        })}
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
        {categoryAction}
        <div className="w-full sm:w-55 min-w-45">
          <LabelDropdown
            placeholder="Category"
            options={filteredCategoryOptions}
            defaultOption={effectiveCategory}
            onSelect={(option) => {
              onFiltersChange({
                ...filters,
                category: option.value as FormsCategory | 'All',
              });
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default FormsFilters;
