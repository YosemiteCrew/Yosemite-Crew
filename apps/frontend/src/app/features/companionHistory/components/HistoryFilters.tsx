import React from 'react';
import SubLabels from '@/app/ui/widgets/Labels/SubLabels';
import {
  HistoryFilterDefinition,
  HistoryFilterKey,
} from '@/app/features/companionHistory/types/history';

type HistoryFiltersProps = {
  filters: HistoryFilterDefinition[];
  activeFilter: HistoryFilterKey;
  onChange: (filter: HistoryFilterKey) => void;
};

const HistoryFilters = ({ filters, activeFilter, onChange }: HistoryFiltersProps) => {
  return (
    <SubLabels
      labels={filters.map((filter) => ({ key: filter.key, name: filter.label }))}
      activeLabel={activeFilter}
      setActiveLabel={(next: string) => onChange(next as HistoryFilterKey)}
    />
  );
};

export default HistoryFilters;
