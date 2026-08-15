import type { CompanionType } from '@yosemite-crew/types';

type OptionProp = {
  label: string;
  value: string;
};

export const BLOOD_GROUP_OPTIONS_BY_SPECIES: Record<CompanionType, OptionProp[]> = {
  cat: ['A', 'B', 'AB', 'Unknown'].map((group) => ({
    value: group,
    label: group,
  })),
  dog: [
    'DEA 1.1 Positive',
    'DEA 1.1 Negative',
    'DEA 1.2 Positive',
    'DEA 1.2 Negative',
    'DEA 3 Positive',
    'DEA 3 Negative',
    'DEA 4 Positive',
    'DEA 4 Negative',
    'DEA 5 Positive',
    'DEA 5 Negative',
    'DEA 7 Positive',
    'DEA 7 Negative',
    'Universal Donor',
    'Unknown',
  ].map((group) => ({
    value: group,
    label: group,
  })),
  horse: ['Aa', 'Ca', 'Da', 'Ka', 'Pa', 'Qa', 'Ua', 'Universal Donor', 'Unknown'].map((group) => ({
    value: group,
    label: group,
  })),
  other: [{ value: 'Unknown', label: 'Unknown' }],
};
