import type { TabOption } from '@/app/ui/primitives/TabToggle/TabToggle';

export type ActiveTab = 'services' | 'packages' | 'archive';

// Segmented-pill options for the speciality catalog switcher (per the warm-bone design).
export const TABS: TabOption[] = [
  { key: 'services', label: 'Services' },
  { key: 'packages', label: 'Packages' },
  { key: 'archive', label: 'Archive' },
];

export const panelId = (key: string) => `panel-${key}`;

export type SearchResult = {
  id: string;
  name: string;
  kind: 'service' | 'package';
  meta: string;
};
