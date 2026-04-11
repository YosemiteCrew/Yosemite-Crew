'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useCompanionsParentsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { useTasksForPrimaryOrg } from '@/app/hooks/useTask';
import { useFormsStore } from '@/app/stores/formsStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSearchStore } from '@/app/stores/searchStore';
import { useUniversalSearchStore } from '@/app/stores/universalSearchStore';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';

type SearchModule =
  | 'appointments'
  | 'tasks'
  | 'companions'
  | 'forms'
  | 'inventory'
  | 'finance'
  | 'idexx';

type SearchItem = {
  id: string;
  module: SearchModule;
  title: string;
  subtitle: string;
  keywords: string;
  href: string;
  isQuick?: boolean;
  onSelect?: () => void;
};

const moduleLabels: Record<SearchModule, string> = {
  appointments: 'Appointments',
  tasks: 'Tasks',
  companions: 'Companions',
  forms: 'Forms',
  inventory: 'Inventory',
  finance: 'Finance',
  idexx: 'IDEXX Hub',
};

const quickLinks: Array<{ module: SearchModule; title: string; href: string }> = [
  { module: 'appointments', title: 'Open Appointments', href: '/appointments' },
  { module: 'tasks', title: 'Open Tasks', href: '/tasks' },
  { module: 'companions', title: 'Open Companions', href: '/companions' },
  { module: 'forms', title: 'Open Forms', href: '/forms' },
  { module: 'inventory', title: 'Open Inventory', href: '/inventory' },
  { module: 'finance', title: 'Open Finance', href: '/finance' },
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
      appointment.companion.name,
      appointment.companion.parent
    );
    moduleItems.push({
      id: `appointments:${appointmentId}`,
      module: 'appointments',
      title: companionDisplayName || 'Appointment',
      subtitle: `${appointment.status} • ${appointment.concern || 'No concern'} • ${appointmentId}`,
      keywords: `${companionDisplayName} ${getOwnerFirstName(appointment.companion.parent)} ${appointment.status || ''} ${appointment.concern || ''} ${appointmentId}`,
      href: `/appointments?appointmentId=${encodeURIComponent(appointmentId)}&open=details`,
    });
  });

  tasks.forEach((task) => {
    const taskId = String(task._id ?? '').trim();
    if (!taskId) return;
    moduleItems.push({
      id: `tasks:${taskId}`,
      module: 'tasks',
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
      title: `Invoice ${invoiceId}`,
      subtitle: `${invoice.status || 'PENDING'} • Appointment ${invoice.appointmentId || '-'}`,
      keywords: `${invoiceId} ${invoice.status || ''} ${invoice.appointmentId || ''}`,
      href: `/finance?invoiceId=${encodeURIComponent(invoiceId)}`,
    });
  });

  return moduleItems;
};

const UniversalSearchPalette = () => {
  const router = useRouter();
  const pathname = usePathname();
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
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);

  const forms = useMemo(
    () => formIds.map((id) => formsById[id]).filter(Boolean),
    [formIds, formsById]
  );

  const inventory = useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = inventoryIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => inventoryById[id]).filter(Boolean);
  }, [primaryOrgId, inventoryIdsByOrgId, inventoryById]);

  const items = useMemo<SearchItem[]>(
    () => buildSearchItems(appointments, tasks, companions, forms, inventory, invoices),
    [appointments, tasks, companions, forms, inventory, invoices]
  );

  const resultItems = useMemo<SearchItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return quickLinks.map(
        (link): SearchItem => ({
          id: `quick:${link.href}`,
          module: link.module,
          title: link.title,
          subtitle: '',
          keywords: link.title,
          href: link.href,
          isQuick: true,
        })
      );
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const scored = items
      .map((item) => {
        const haystack = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
        const allTokensMatch = tokens.every((token) => haystack.includes(token));
        if (!allTokensMatch) return null;
        const score = tokens.reduce((total, token) => {
          const idx = haystack.indexOf(token);
          return total + (idx === -1 ? 9999 : idx);
        }, 0);
        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => (a?.score ?? 0) - (b?.score ?? 0))
      .slice(0, 40)
      .map((entry) => entry?.item)
      .filter(Boolean) as SearchItem[];

    const idexxAction: SearchItem[] = [
      {
        id: `idexx:search:${q}`,
        module: 'idexx',
        title: `Search "${query.trim()}" in IDEXX Hub`,
        subtitle: 'Open IDEXX Hub with header search query',
        keywords: `idexx ${q}`,
        href: '/appointments/idexx-workspace',
        onSelect: () => setHeaderSearchQuery(query.trim()),
      },
    ];

    return [...scored, ...idexxAction];
  }, [items, query, setHeaderSearchQuery]);

  const selectItem = useCallback(
    (item?: SearchItem) => {
      if (!item) return;
      item.onSelect?.();
      close();
      setQuery('');
      startRouteLoader();
      router.push(item.href);
    },
    [close, router]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const withCommandKey = event.metaKey || event.ctrlKey;

      if (withCommandKey && (key === 'k' || key === 'p')) {
        event.preventDefault();
        open();
        return;
      }

      if (!isOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => getNextResultIndex(prev, resultItems.length, 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => getNextResultIndex(prev, resultItems.length, -1));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        selectItem(resultItems[activeIndex]);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, close, isOpen, open, resultItems, selectItem]);

  useEffect(() => {
    close();
    setQuery('');
  }, [pathname, close]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(0);
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

  return createPortal(
    <div className="fixed inset-0 z-[1200] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_rgba(48,47,46,0.45))] backdrop-blur-[8px] p-2 sm:p-6">
      <button
        type="button"
        aria-label="Close universal search"
        className="absolute inset-0"
        onClick={close}
      />
      <section className="mx-auto mt-2 sm:mt-8 w-full max-w-2xl overflow-hidden rounded-2xl! border border-white/40 bg-white/68 shadow-[0_24px_70px_rgba(29,28,27,0.24)] backdrop-blur-xl">
        <div className="border-b border-white/55 bg-gradient-to-r from-brand-100/60 via-white/65 to-white/55 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2 rounded-2xl! border border-white/70 bg-white/72 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search appointments, tasks, companions, forms, inventory, finance..."
              className="w-full border-0 bg-transparent font-satoshi text-body-4 text-text-primary outline-none placeholder:text-input-text-placeholder"
              aria-label="Universal search input"
            />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2.5 scrollbar-custom sm:p-3">
          {resultItems.length === 0 ? (
            <div className="px-4 py-7 text-center font-satoshi text-body-4 text-text-secondary">
              No matches found. Try a broader keyword.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {resultItems.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    ref={isActive ? activeRowRef : null}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectItem(item)}
                    className={`flex w-full min-h-[64px] items-center rounded-2xl! px-3 py-2.5 text-left transition-all duration-150 ${
                      isActive
                        ? 'border border-brand-500/35 bg-[linear-gradient(135deg,rgba(242,248,255,0.92),rgba(255,255,255,0.88))] shadow-[0_6px_18px_rgba(36,122,237,0.12)]'
                        : 'border border-white/45 bg-white/62 hover:border-brand-500/25 hover:bg-white/78'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate pr-2 font-satoshi text-body-4 text-text-primary">
                          {item.title}
                        </div>
                        <div className="shrink-0 rounded-xl border border-white/65 bg-white/72 px-2 py-0.5 font-satoshi text-[0.65rem] font-medium uppercase tracking-[0.05em] text-text-secondary">
                          {moduleLabels[item.module]}
                        </div>
                      </div>
                      {item.subtitle && !item.isQuick ? (
                        <div className="truncate pt-0.5 font-satoshi text-caption-1 text-text-secondary">
                          {item.subtitle}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
};

export default UniversalSearchPalette;
