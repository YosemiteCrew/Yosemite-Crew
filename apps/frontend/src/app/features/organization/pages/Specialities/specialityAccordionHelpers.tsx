import type { TabOption } from '@/app/ui/primitives/TabToggle/TabToggle';
import { MdOutlineArchive } from 'react-icons/md';

export type ActiveTab = 'services' | 'packages' | 'archive';

export const TABS: TabOption[] = [
  { key: 'services', label: 'All Services' },
  { key: 'packages', label: 'All Packages' },
  { key: 'archive', label: 'Archive', icon: <MdOutlineArchive size={14} aria-hidden="true" /> },
];

export const panelId = (key: string) => `panel-${key}`;

export type SearchResult = {
  id: string;
  name: string;
  kind: 'service' | 'package';
  meta: string;
};
