'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import {
  IoAdd,
  IoCalendarOutline,
  IoCheckmarkDoneOutline,
  IoCubeOutline,
  IoDocumentTextOutline,
  IoGridOutline,
  IoPaw,
  IoReceiptOutline,
  IoSearchOutline,
  IoTimeOutline,
  IoWalletOutline,
} from 'react-icons/io5';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { useTasksForPrimaryOrg } from '@/app/hooks/useTask';
import { useFormsStore } from '@/app/stores/formsStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSearchStore } from '@/app/stores/searchStore';
import { useUniversalSearchStore } from '@/app/stores/universalSearchStore';
import { useIsPhone } from '@/app/ui/layout/PhoneShell/useIsPhone';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';
import { getAppointmentCompanion } from '@/app/lib/appointments';
import { getJsonStorageItem, setJsonStorageItem } from '@/app/lib/browserStorage';
import './UniversalSearch.css';

type SearchModule =
  'appointments' | 'tasks' | 'companions' | 'forms' | 'inventory' | 'finance' | 'idexx';

type SearchGroupKey = SearchModule | 'jump' | 'recent';

type IconKey =
  | 'paw'
  | 'calendar'
  | 'tasks'
  | 'receipt'
  | 'form'
  | 'cube'
  | 'add'
  | 'dashboard'
  | 'wallet'
  | 'time';

type SearchItem = {
  id: string;
  module: SearchModule;
  groupKey: SearchGroupKey;
  iconKey: IconKey;
  title: string;
  subtitle: string;
  keywords: string;
  href: string;
  keycap?: string;
  onSelect?: () => void;
};

type RowIconProps = { size?: number; className?: string; 'aria-hidden'?: boolean };

const ICONS: Record<IconKey, React.ComponentType<RowIconProps>> = {
  paw: IoPaw,
  calendar: IoCalendarOutline,
  tasks: IoCheckmarkDoneOutline,
  receipt: IoReceiptOutline,
  form: IoDocumentTextOutline,
  cube: IoCubeOutline,
  add: IoAdd,
  dashboard: IoGridOutline,
  wallet: IoWalletOutline,
  time: IoTimeOutline,
};

const MODULE_ICON: Record<SearchModule, IconKey> = {
  appointments: 'calendar',
  tasks: 'tasks',
  companions: 'paw',
  forms: 'form',
  inventory: 'cube',
  finance: 'receipt',
  idexx: 'add',
};

// Fixed section order + eyebrow copy. "Patients" = companions, "Invoices" =
// finance, "Actions" = the IDEXX quick action, per the design spec.
const GROUP_ORDER: SearchModule[] = [
  'companions',
  'appointments',
  'tasks',
  'finance',
  'forms',
  'inventory',
  'idexx',
];

const GROUP_LABELS: Record<SearchGroupKey, string> = {
  companions: 'Patients',
  appointments: 'Appointments',
  tasks: 'Tasks',
  finance: 'Invoices',
  forms: 'Forms',
  inventory: 'Inventory',
  idexx: 'Actions',
  jump: 'Jump to',
  recent: 'Recent',
};

// Empty-query state. "Recent" lists the last few records actually opened from
// the palette (persisted locally); the "Jump to" entries below it are all real
// routes. Dashboard + Appointments carry the spec's G-D / G-A keycaps.
// Recents hold record TITLES - companion and patient names, appointment
// concerns, task and form names, invoice ids - so they are tenant data, not a UI
// preference. The key is namespaced per organisation so switching organisation
// cannot surface the previous one's records, and `resetSessionStores` clears the
// whole prefix on sign-out so the next user of this browser profile starts empty.
export const RECENTS_STORAGE_KEY_PREFIX = 'yc_universal_search_recents:';
const RECENTS_LIMIT = 3;

const recentsStorageKey = (orgId: string) => `${RECENTS_STORAGE_KEY_PREFIX}${orgId}`;

type RecentEntry = { title: string; href: string };

const readRecents = (orgId: string | null): RecentEntry[] => {
  if (!orgId) return [];
  const stored = getJsonStorageItem<RecentEntry[]>('local', recentsStorageKey(orgId));
  return Array.isArray(stored) ? stored.slice(0, RECENTS_LIMIT) : [];
};

const writeRecent = (orgId: string | null, entry: RecentEntry): RecentEntry[] => {
  if (!orgId) return [];
  const next = [entry, ...readRecents(orgId).filter((item) => item.href !== entry.href)].slice(
    0,
    RECENTS_LIMIT
  );
  setJsonStorageItem('local', recentsStorageKey(orgId), next);
  return next;
};

const JUMP_LINKS: Array<{ title: string; href: string; iconKey: IconKey; keycap?: string }> = [
  { title: 'Dashboard', href: '/dashboard', iconKey: 'dashboard', keycap: 'G D' },
  { title: 'Appointments', href: '/appointments', iconKey: 'calendar', keycap: 'G A' },
  { title: 'Tasks', href: '/tasks', iconKey: 'tasks' },
  { title: 'Companions', href: '/companions', iconKey: 'paw' },
  { title: 'Finance', href: '/finance', iconKey: 'wallet' },
  { title: 'Inventory', href: '/inventory', iconKey: 'cube' },
  { title: 'Forms', href: '/forms', iconKey: 'form' },
];

const getParentName = (firstName?: string) =>
  [firstName].filter(Boolean).join(' ').trim() || 'Unknown';

const getNextResultIndex = (activeIndex: number, resultCount: number, direction: 1 | -1) => {
  const safeCount = Math.max(resultCount, 1);
  return (activeIndex + direction + safeCount) % safeCount;
};

const buildSearchItems = (
  appointments: ReturnType<typeof useAppointmentsForPrimaryOrg>,
  tasks: ReturnType<typeof useTasksForPrimaryOrg>,
  companions: ReturnType<typeof useCompanionsParentsForPrimaryOrg>,
  forms: Array<Record<string, any>>,
  inventory: Array<Record<string, any>>,
  invoices: ReturnType<typeof useInvoicesForPrimaryOrg>
): SearchItem[] => {
  const moduleItems: SearchItem[] = [];

  appointments.forEach((appointment) => {
    const appointmentId = String(appointment.id ?? '').trim();
    if (!appointmentId) return;
    const companionDisplayName = formatCompanionNameWithOwnerLastName(
      getAppointmentCompanion(appointment).name,
      getAppointmentCompanion(appointment).parent
    );
    moduleItems.push({
      id: `appointments:${appointmentId}`,
      module: 'appointments',
      groupKey: 'appointments',
      iconKey: MODULE_ICON.appointments,
      /* v8 ignore next -- formatCompanionNameWithOwnerLastName never returns an empty string */
      title: companionDisplayName || 'Appointment',
      subtitle: `${appointment.status} • ${appointment.concern || 'No concern'} • ${appointmentId}`,
      keywords: `${companionDisplayName} ${getOwnerFirstName(getAppointmentCompanion(appointment).parent)} ${appointment.status || ''} ${appointment.concern || ''} ${appointmentId}`,
      href: `/appointments?appointmentId=${encodeURIComponent(appointmentId)}&open=details`,
    });
  });

  tasks.forEach((task) => {
    const taskId = String(task._id ?? '').trim();
    if (!taskId) return;
    moduleItems.push({
      id: `tasks:${taskId}`,
      module: 'tasks',
      groupKey: 'tasks',
      iconKey: MODULE_ICON.tasks,
      title: task.name || 'Task',
      subtitle: `${task.status || 'UNKNOWN'} • ${task.category || 'General'} • ${taskId}`,
      keywords: `${task.name || ''} ${task.description || ''} ${task.status || ''} ${task.category || ''} ${taskId}`,
      href: `/tasks?taskId=${encodeURIComponent(taskId)}`,
    });
  });

  companions.forEach((companionParent) => {
    const companionId = String(companionParent.companion.id ?? '').trim();
    if (!companionId) return;
    const companionDisplayName = formatCompanionNameWithOwnerLastName(
      companionParent.companion.name,
      companionParent.parent
    );
    moduleItems.push({
      id: `companions:${companionId}`,
      module: 'companions',
      groupKey: 'companions',
      iconKey: MODULE_ICON.companions,
      /* v8 ignore next -- formatCompanionNameWithOwnerLastName never returns an empty string */
      title: companionDisplayName || 'Companion',
      subtitle: `${companionParent.companion.type || 'Unknown species'} • Parent: ${getParentName(companionParent.parent.firstName)} • ${companionId}`,
      keywords: `${companionDisplayName} ${getParentName(companionParent.parent.firstName)} ${companionParent.companion.type || ''} ${companionParent.companion.status || ''} ${companionId}`,
      href: `/companions?companionId=${encodeURIComponent(companionId)}`,
    });
  });

  forms.forEach((form) => {
    const formId = String(form?._id ?? '').trim();
    if (!formId) return;
    moduleItems.push({
      id: `forms:${formId}`,
      module: 'forms',
      groupKey: 'forms',
      iconKey: MODULE_ICON.forms,
      title: form.name || 'Form',
      subtitle: `${form.category || 'Custom'} • ${form.status || 'Draft'} • ${formId}`,
      keywords: `${form.name || ''} ${form.description || ''} ${form.category || ''} ${form.status || ''} ${formId}`,
      href: `/forms?formId=${encodeURIComponent(formId)}`,
    });
  });

  inventory.forEach((item) => {
    const inventoryId = String(item.id ?? '').trim();
    if (!inventoryId) return;
    moduleItems.push({
      id: `inventory:${inventoryId}`,
      module: 'inventory',
      groupKey: 'inventory',
      iconKey: MODULE_ICON.inventory,
      title: item.basicInfo.name || 'Inventory item',
      subtitle: `${item.basicInfo.category || 'Uncategorized'} • ${item.status || 'ACTIVE'} • ${inventoryId}`,
      keywords: `${item.basicInfo.name || ''} ${item.basicInfo.description || ''} ${item.basicInfo.category || ''} ${item.status || ''} ${inventoryId}`,
      href: `/inventory?inventoryId=${encodeURIComponent(inventoryId)}`,
    });
  });

  invoices.forEach((invoice) => {
    const invoiceId = String(invoice.id ?? '').trim();
    if (!invoiceId) return;
    moduleItems.push({
      id: `finance:${invoiceId}`,
      module: 'finance',
      groupKey: 'finance',
      iconKey: MODULE_ICON.finance,
      title: `Invoice ${invoiceId}`,
      subtitle: `${invoice.status || 'PENDING'} • Appointment ${invoice.appointmentId || '-'}`,
      keywords: `${invoiceId} ${invoice.status || ''} ${invoice.appointmentId || ''}`,
      href: `/finance?invoiceId=${encodeURIComponent(invoiceId)}`,
    });
  });

  return moduleItems;
};

// The design's empty-query rows ("Recent" / "Jump to") are a lighter treatment
// than a result row: a bare glyph and plain copy, no icon tile.
const isPlainRow = (groupKey: SearchGroupKey) => groupKey === 'jump' || groupKey === 'recent';

const RowIcon = ({ item }: { item: SearchItem }) => {
  const Icon = ICONS[item.iconKey];
  const isPatient = item.groupKey === 'companions';
  const isAction = item.groupKey === 'idexx';
  const shapeClass = isPatient ? 'yc-usp-icon--avatar' : 'yc-usp-icon--tile';
  const toneClass = isAction ? 'yc-usp-icon--neutral' : 'yc-usp-icon--blue';
  return (
    <span className={`yc-usp-icon ${shapeClass} ${toneClass}`} aria-hidden>
      <Icon size={16} />
    </span>
  );
};

const RowBody = ({ item }: { item: SearchItem }) => {
  const Icon = ICONS[item.iconKey];
  if (isPlainRow(item.groupKey)) {
    return (
      <>
        <Icon size={14} className="yc-usp-row-plain-icon" aria-hidden />
        <span className="yc-usp-row-plain-label">{item.title}</span>
      </>
    );
  }
  return (
    <>
      <RowIcon item={item} />
      <span className="yc-usp-row-body">
        <span className="yc-usp-row-title">{item.title}</span>
        {item.subtitle ? <span className="yc-usp-row-sub">{item.subtitle}</span> : null}
      </span>
    </>
  );
};

const DESKTOP_FOOTER = (
  <div className="yc-usp-foot">
    <div className="yc-usp-foot-hints">
      <span className="yc-usp-keyhint">
        <span className="yc-usp-keycap">↑↓</span> Navigate
      </span>
      <span className="yc-usp-keyhint">
        <span className="yc-usp-keycap">↵</span> Open
      </span>
      <span className="yc-usp-keyhint">
        <span className="yc-usp-keycap">⌘↵</span> Open in workspace
      </span>
    </div>
    <span className="yc-usp-foot-scope">Searches patients, visits, invoices, team, pages</span>
  </div>
);

const PHONE_FOOTER = (
  <div className="yc-usp-foot yc-usp-foot--phone">
    <span className="yc-usp-foot-scope">Searches patients, visits, invoices, team</span>
  </div>
);

type IndexedRow = { item: SearchItem; index: number };
type ResultGroup = { key: SearchGroupKey; label: string; rows: IndexedRow[] };

const SearchInput = ({
  inputRef,
  query,
  onQueryChange,
  isPhone,
  onClose,
}: {
  inputRef: React.Ref<HTMLInputElement>;
  query: string;
  onQueryChange: (value: string) => void;
  isPhone: boolean;
  onClose: () => void;
}) => (
  <div className="yc-usp-input-row">
    <span className="yc-usp-field">
      <IoSearchOutline className="yc-usp-search-icon" size={18} aria-hidden />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search anything…"
        className="yc-usp-input"
        aria-label="Universal search input"
      />
    </span>
    {isPhone ? (
      <button type="button" className="yc-usp-cancel" onClick={onClose}>
        Cancel
      </button>
    ) : (
      <button type="button" className="yc-usp-esc" onClick={onClose} aria-label="Close search">
        ESC
      </button>
    )}
  </div>
);

const SearchResults = ({
  groups,
  activeIndex,
  activeRowRef,
  onActivate,
  onSelect,
}: {
  groups: ResultGroup[];
  activeIndex: number;
  activeRowRef: React.Ref<HTMLButtonElement>;
  onActivate: (index: number) => void;
  onSelect: (item: SearchItem) => void;
}) => (
  <div className="yc-usp-results scrollbar-custom">
    {groups.map((group) => (
      <div key={group.key} className="yc-usp-group">
        <div className="yc-usp-eyebrow">{group.label}</div>
        {group.rows.map(({ item, index }) => {
          const isActive = index === activeIndex;
          const keycap = item.keycap ?? (isActive ? '↵' : undefined);
          return (
            <button
              key={item.id}
              ref={isActive ? activeRowRef : null}
              type="button"
              onMouseEnter={() => onActivate(index)}
              onClick={() => onSelect(item)}
              className={`yc-usp-row ${isPlainRow(item.groupKey) ? 'yc-usp-row--plain' : ''} ${
                isActive ? 'yc-usp-row--active' : ''
              }`}
            >
              <RowBody item={item} />
              {keycap ? <span className="yc-usp-keycap">{keycap}</span> : null}
            </button>
          );
        })}
      </div>
    ))}
  </div>
);

const PhonePanel = ({ input, results }: { input: React.ReactNode; results: React.ReactNode }) => (
  <div className="yc-usp-overlay yc-usp-overlay--phone">
    <dialog open className="yc-usp-panel yc-usp-panel--phone" aria-label="Universal search">
      <div className="yc-usp-statusbar" aria-hidden />
      {input}
      {results}
      {PHONE_FOOTER}
      <span className="yc-usp-home-indicator" aria-hidden />
    </dialog>
  </div>
);

const DesktopPanel = ({
  input,
  results,
  onClose,
}: {
  input: React.ReactNode;
  results: React.ReactNode;
  onClose: () => void;
}) => (
  <div className="yc-usp-overlay">
    <button
      type="button"
      aria-label="Close universal search"
      className="yc-usp-backdrop"
      onClick={onClose}
    />
    <dialog open className="yc-usp-panel" aria-label="Universal search">
      {input}
      {results}
      {DESKTOP_FOOTER}
    </dialog>
  </div>
);

const UniversalSearchPalette = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isPhone = useIsPhone();
  const isOpen = useUniversalSearchStore((s) => s.isOpen);
  const open = useUniversalSearchStore((s) => s.open);
  const close = useUniversalSearchStore((s) => s.close);
  const setHeaderSearchQuery = useSearchStore((s) => s.setQuery);

  const appointments = useAppointmentsForPrimaryOrg();
  const tasks = useTasksForPrimaryOrg();
  const companions = useCompanionsParentsForPrimaryOrg();
  const invoices = useInvoicesForPrimaryOrg();

  const formIds = useFormsStore((s) => s.formIds);
  const formsById = useFormsStore((s) => s.formsById);

  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const inventoryIdsByOrgId = useInventoryStore((s) => s.itemIdsByOrgId);
  const inventoryById = useInventoryStore((s) => s.itemsById);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);

  const forms = useMemo(
    () =>
      formIds.flatMap((id) => {
        const form = formsById[id];
        return form ? [form] : [];
      }),
    [formIds, formsById]
  );

  const inventory = useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = inventoryIdsByOrgId[primaryOrgId] ?? [];
    return ids.flatMap((id) => {
      const inventoryItem = inventoryById[id];
      return inventoryItem ? [inventoryItem] : [];
    });
  }, [primaryOrgId, inventoryIdsByOrgId, inventoryById]);

  const items = useMemo<SearchItem[]>(
    () => buildSearchItems(appointments, tasks, companions, forms, inventory, invoices),
    [appointments, tasks, companions, forms, inventory, invoices]
  );

  const hasQuery = query.trim().length > 0;

  const resultItems = useMemo<SearchItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const recentRows = recents.map((entry): SearchItem => ({
        id: `recent:${entry.href}`,
        module: 'appointments',
        groupKey: 'recent',
        iconKey: 'time',
        title: entry.title,
        subtitle: '',
        keywords: entry.title,
        href: entry.href,
      }));
      const jumpRows = JUMP_LINKS.map((link): SearchItem => ({
        id: `jump:${link.href}`,
        module: 'appointments',
        groupKey: 'jump',
        iconKey: link.iconKey,
        title: link.title,
        subtitle: '',
        keywords: link.title,
        href: link.href,
        keycap: link.keycap,
      }));
      return [...recentRows, ...jumpRows];
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const scored = items
      .flatMap((item) => {
        const haystack = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
        const allTokensMatch = tokens.every((token) => haystack.includes(token));
        if (!allTokensMatch) return [];
        const score = tokens.reduce((total, token) => {
          const idx = haystack.indexOf(token);
          /* v8 ignore next -- token is guaranteed present by the allTokensMatch filter above */
          return total + (idx === -1 ? 9999 : idx);
        }, 0);
        return [{ item, score }];
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map((entry) => entry.item);

    const idexxAction: SearchItem = {
      id: `idexx:search:${q}`,
      module: 'idexx',
      groupKey: 'idexx',
      iconKey: MODULE_ICON.idexx,
      title: `Search "${query.trim()}" in IDEXX Hub`,
      subtitle: 'Open IDEXX Hub with header search query',
      keywords: `idexx ${q}`,
      href: '/appointments/idexx-workspace',
      onSelect: () => setHeaderSearchQuery(query.trim()),
    };

    // Reorder into fixed group order so keyboard navigation follows the grouped
    // visual order; the IDEXX action lands last in "Actions".
    const combined = [...scored, idexxAction];
    return GROUP_ORDER.flatMap((mod) => combined.filter((item) => item.groupKey === mod));
  }, [items, query, recents, setHeaderSearchQuery]);

  const renderGroups = useMemo(() => {
    const indexed = resultItems.map((item, index) => ({ item, index }));
    if (!hasQuery) {
      const emptyStateGroups: SearchGroupKey[] = ['recent', 'jump'];
      return emptyStateGroups.flatMap((key) => {
        const rows = indexed.filter((entry) => entry.item.groupKey === key);
        return rows.length > 0 ? [{ key, label: GROUP_LABELS[key], rows }] : [];
      });
    }
    return GROUP_ORDER.reduce<Array<{ key: SearchGroupKey; label: string; rows: typeof indexed }>>(
      (groups, mod) => {
        const rows = indexed.filter((entry) => entry.item.groupKey === mod);
        if (rows.length > 0) {
          groups.push({ key: mod, label: GROUP_LABELS[mod], rows });
        }
        return groups;
      },
      []
    );
  }, [resultItems, hasQuery]);

  const selectItem = useCallback(
    (item?: SearchItem) => {
      /* v8 ignore next -- selectItem is only ever invoked with a defined row */
      if (!item) return;
      item.onSelect?.();
      // "Jump to" rows are nav shortcuts, not records — only opened records (and
      // re-opened recents) feed the design's "Recent" list.
      if (item.groupKey !== 'jump') {
        setRecents(writeRecent(primaryOrgId, { title: item.title, href: item.href }));
      }
      close();
      setQuery('');
      startRouteLoader();
      router.push(item.href);
    },
    [close, router, primaryOrgId]
  );

  const isOpenRef = useRef(isOpen);
  const activeIndexRef = useRef(activeIndex);
  const resultItemsRef = useRef(resultItems);
  const openRef = useRef(open);
  const closeRef = useRef(close);
  const selectItemRef = useRef(selectItem);
  // No dep array: keep the latest values readable from the mount-only keydown
  // listener below without resubscribing it on every render.
  useEffect(() => {
    isOpenRef.current = isOpen;
    activeIndexRef.current = activeIndex;
    resultItemsRef.current = resultItems;
    openRef.current = open;
    closeRef.current = close;
    selectItemRef.current = selectItem;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const withCommandKey = event.metaKey || event.ctrlKey;

      if (withCommandKey && (key === 'k' || key === 'p')) {
        event.preventDefault();
        openRef.current();
        return;
      }

      if (!isOpenRef.current) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => getNextResultIndex(prev, resultItemsRef.current.length, 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => getNextResultIndex(prev, resultItemsRef.current.length, -1));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        selectItemRef.current(resultItemsRef.current[activeIndexRef.current]);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Render-phase adjustments (React's documented setState-during-render reset
  // pattern): clear the query when the route changes, and reset the highlight +
  // re-read persisted recents whenever the palette opens.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setQuery('');
  }
  // Seeded false (not isOpen) so mounting with the palette already open still
  // runs the open reset, matching the old effect's mount run.
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setActiveIndex(0);
      setRecents(readRecents(primaryOrgId));
    }
  }

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = globalThis.window?.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => {
      if (timeout) globalThis.window.clearTimeout(timeout);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  useEffect(() => {
    if (!isOpen || globalThis.document === undefined) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || globalThis.document === undefined) return null;

  const inputRow = (
    <SearchInput
      inputRef={inputRef}
      query={query}
      onQueryChange={setQuery}
      isPhone={isPhone}
      onClose={close}
    />
  );

  const results = (
    <SearchResults
      groups={renderGroups}
      activeIndex={activeIndex}
      activeRowRef={activeRowRef}
      onActivate={setActiveIndex}
      onSelect={selectItem}
    />
  );

  if (isPhone) {
    return createPortal(<PhonePanel input={inputRow} results={results} />, document.body);
  }

  return createPortal(
    <DesktopPanel input={inputRow} results={results} onClose={close} />,
    document.body
  );
};

export default UniversalSearchPalette;
