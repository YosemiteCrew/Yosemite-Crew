'use client';

/**
 * Share-from-PIMS picker. Lets staff pick a companion or appointment from the
 * already-loaded stores and share it into the active chat via the share
 * endpoint (which records the audit row and posts the Stream card). The
 * Companion tab label carries the org-configurable animal noun; "Pet parent"
 * is never rewritten.
 */

import { useMemo, useState } from 'react';
import {
  IoCalendarOutline,
  IoClose,
  IoMedkitOutline,
  IoSearchOutline,
  IoShareSocialOutline,
} from 'react-icons/io5';
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
        ? new Date(a.startTime).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC',
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
    icon: typeof IoMedkitOutline;
  }> = [
    { key: 'COMPANION', label: rewrite('Companions'), icon: IoMedkitOutline },
    { key: 'APPOINTMENT', label: 'Appointments', icon: IoCalendarOutline },
  ];

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-start justify-center border-0 bg-[var(--scrim,rgba(29,28,27,0.44))] p-4 pt-24"
      aria-label="Share to chat"
    >
      <button
        type="button"
        aria-label="Close picker"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      {/* Design ("Share entity modal"): 470px card, 20px radius, 15px/700 title. */}
      <div className="relative z-10 flex w-full max-w-[470px] flex-col overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_2px_6px_var(--sh05),0_22px_56px_var(--sh10)]">
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 pb-3.5 pt-4">
          <span className="flex items-center gap-2">
            <IoShareSocialOutline className="h-4 w-4 text-[var(--blue-text)]" />
            <Text
              as="span"
              variant="body-3-emphasis"
              className="text-[15px] font-bold text-[var(--ink)]"
            >
              Share to chat
            </Text>
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex size-[30px] items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-faint)] hover:bg-[var(--screen-2)]"
          >
            <IoClose className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[var(--hairline)] px-3 py-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={clsx(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                tab === key
                  ? 'bg-[var(--blue-soft)] text-[var(--blue-text)]'
                  : 'text-[var(--ink-faint)] hover:bg-[var(--screen-2)]'
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-4 py-2">
          <IoSearchOutline className="h-4 w-4 shrink-0 text-[var(--ink-faint)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search records"
            className="w-full bg-transparent font-satoshi text-sm text-[var(--ink-body)] outline-none placeholder:text-[var(--ink-faint)]"
          />
        </div>

        <ul className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center">
              <Text as="span" variant="body-4" className="text-[var(--ink-faint)]">
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
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--screen-2)] disabled:opacity-60"
                >
                  <ChatAvatar name={item.title} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Text
                      as="span"
                      variant="body-4-emphasis"
                      className="truncate text-[var(--ink)]"
                    >
                      {item.title}
                    </Text>
                    {item.subtitle && (
                      <Text
                        as="span"
                        variant="caption-1"
                        className="truncate text-[var(--ink-faint)]"
                      >
                        {item.subtitle}
                      </Text>
                    )}
                  </span>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--cta)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--cta-text)]">
                    {sharing === item.id ? 'Sharing…' : 'Share'}
                  </span>
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
