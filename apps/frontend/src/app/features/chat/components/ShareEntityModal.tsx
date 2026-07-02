'use client';

/**
 * Share-from-PIMS picker. Lets staff pick a companion or appointment from the
 * already-loaded stores and share it into the active chat via the share
 * endpoint (which records the audit row and posts the Stream card). The
 * Companion tab label carries the org-configurable animal noun; "Pet parent"
 * is never rewritten.
 */

import { useMemo, useState } from 'react';
import { LuSearch, LuStethoscope, LuCalendar, LuX, LuShare2 } from 'react-icons/lu';
import clsx from 'clsx';
import type { Appointment } from '@yosemite-crew/types';
import Text from '@/app/ui/Text';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { shareEntityToChannel, type SharedEntityType } from '../services/chatService';
import { ChatAvatar } from './ChatAvatar';

type PickItem = {
  id: string;
  title: string;
  subtitle?: string;
  entityType: SharedEntityType;
};

const MAX_ITEMS = 50;

export function ShareEntityModal({
  channelId,
  onClose,
}: Readonly<{ channelId: string; onClose: () => void }>) {
  const rewrite = useCompanionTerminologyText();
  const companions = useCompanionStore((s) => s.companionsById);
  const appointments = useAppointmentStore((s) => s.appointmentsById);
  const [tab, setTab] = useState<'COMPANION' | 'APPOINTMENT'>('COMPANION');
  const [query, setQuery] = useState('');
  const [sharing, setSharing] = useState<string | null>(null);

  const items = useMemo<PickItem[]>(() => {
    if (tab === 'COMPANION') {
      return Object.entries(companions).map(([id, c]) => {
        const pet = c as { name?: string; species?: string; breed?: string };
        return {
          id,
          title: pet.name ?? 'Companion',
          subtitle: [pet.species, pet.breed].filter(Boolean).join(' · ') || undefined,
          entityType: 'COMPANION' as const,
        };
      });
    }
    return Object.entries(appointments).map(([id, raw]) => {
      const a = raw as Appointment;
      const when = a.startTime
        ? new Date(a.startTime).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : undefined;
      return {
        id,
        title: a.patient?.name ?? a.companion?.name ?? 'Appointment',
        subtitle: when,
        entityType: 'APPOINTMENT' as const,
      };
    });
  }, [tab, companions, appointments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? items.filter(
          (i) => i.title.toLowerCase().includes(q) || Boolean(i.subtitle?.toLowerCase().includes(q))
        )
      : items;
    return matched.slice(0, MAX_ITEMS);
  }, [items, query]);

  const share = async (item: PickItem) => {
    setSharing(item.id);
    try {
      await shareEntityToChannel({
        channelId,
        entityType: item.entityType,
        entityId: item.id,
        title: item.title,
        snapshot: item.subtitle ? { subtitle: item.subtitle } : undefined,
      });
      onClose();
    } catch {
      // surfaced + logged in the service layer
    } finally {
      setSharing(null);
    }
  };

  const tabs: ReadonlyArray<{
    key: 'COMPANION' | 'APPOINTMENT';
    label: string;
    icon: typeof LuStethoscope;
  }> = [
    { key: 'COMPANION', label: rewrite('Companions'), icon: LuStethoscope },
    { key: 'APPOINTMENT', label: 'Appointments', icon: LuCalendar },
  ];

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-start justify-center border-0 bg-neutral-900/30 p-4 pt-24"
      aria-label="Share from PIMS"
    >
      <button
        type="button"
        aria-label="Close picker"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-chat-divider bg-neutral-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-chat-divider px-4 py-3">
          <span className="flex items-center gap-2">
            <LuShare2 className="h-4 w-4 text-primary-600" />
            <Text as="span" variant="body-3-emphasis" className="text-neutral-900">
              Share from PIMS
            </Text>
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-chat-surface-soft"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-chat-divider px-3 py-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={clsx(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                tab === key
                  ? 'bg-chat-panel text-primary-700'
                  : 'text-neutral-500 hover:bg-chat-surface-soft'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border-b border-chat-divider px-4 py-2">
          <LuSearch className="h-4 w-4 shrink-0 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search records"
            className="w-full bg-transparent font-satoshi text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </div>

        <ul className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center">
              <Text as="span" variant="body-4" className="text-neutral-400">
                Nothing to share here yet
              </Text>
            </li>
          ) : (
            filtered.map((item) => (
              <li key={`${item.entityType}-${item.id}`}>
                <button
                  type="button"
                  disabled={sharing === item.id}
                  onClick={() => void share(item)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-chat-surface-soft disabled:opacity-60"
                >
                  <ChatAvatar name={item.title} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Text as="span" variant="body-4-emphasis" className="truncate text-neutral-900">
                      {item.title}
                    </Text>
                    {item.subtitle && (
                      <Text as="span" variant="caption-1" className="truncate text-neutral-500">
                        {item.subtitle}
                      </Text>
                    )}
                  </span>
                  <Text
                    as="span"
                    variant="caption-2"
                    className="shrink-0 font-semibold text-primary-600"
                  >
                    {sharing === item.id ? 'Sharing…' : 'Share'}
                  </Text>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </dialog>
  );
}

export default ShareEntityModal;
