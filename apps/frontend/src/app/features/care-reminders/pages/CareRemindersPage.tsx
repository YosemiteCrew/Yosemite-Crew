'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Primary } from '@/app/ui/primitives/Buttons';
import PermissionGate from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { logger } from '@/app/lib/logger';
import {
  createCareReminders,
  listCareReminders,
  sendCareReminder,
  type CareReminder,
  type CareReminderType,
} from '@/app/services/careReminderService';

const REMINDER_TYPES: Array<{ value: CareReminderType; label: string }> = [
  { value: 'VACCINATION_BOOSTER', label: 'Vaccination booster' },
  { value: 'ANNUAL_CHECKUP', label: 'Annual check-up' },
  { value: 'PARASITE_TREATMENT', label: 'Parasite treatment' },
  { value: 'DENTAL_CLEANING', label: 'Dental cleaning' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'CUSTOM', label: 'Other care' },
];

const CHANNEL_LABELS = {
  delivered: 'delivered',
  failed: 'not delivered',
  suppressed: 'opted out',
  unreachable: 'no destination',
} as const;
const EMPTY_COMPANION_IDS: string[] = [];

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';

const scheduleButtonLabel = (saving: boolean, count: number) => {
  if (saving) return 'Scheduling…';
  return count === 1 ? 'Schedule 1 reminder' : `Schedule ${count || ''} reminders`;
};

const deliveryText = (reminder: CareReminder) => {
  if (reminder.lastDelivery) {
    return `Push ${CHANNEL_LABELS[reminder.lastDelivery.push]} · Email ${CHANNEL_LABELS[reminder.lastDelivery.email]}`;
  }
  if (reminder.status === 'SENDING') {
    const elapsed = reminder.sendingAt ? Date.now() - Date.parse(reminder.sendingAt) : 0;
    if (elapsed > 5 * 60 * 1000) return 'No result recorded — check delivery before retrying.';
    return 'Delivery in progress';
  }
  return 'Not sent yet';
};

const statusLabel = (reminder: CareReminder) =>
  reminder.status === 'SENDING' && deliveryText(reminder).startsWith('No result')
    ? 'check delivery'
    : reminder.status.toLowerCase();

const sendButtonLabel = (reminder: CareReminder, sendingId: string | null) => {
  if (sendingId === reminder.id) return 'Sending…';
  return reminder.lastAttemptAt ? 'Retry send' : 'Send now';
};

const CareRemindersPage = () => {
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const companionIds = useCompanionStore((state) =>
    organisationId
      ? (state.companionsIdsByOrgId[organisationId] ?? EMPTY_COMPANION_IDS)
      : EMPTY_COMPANION_IDS
  );
  const companionsById = useCompanionStore((state) => state.companionsById);
  const companions = useMemo(
    () => companionIds.map((id) => companionsById[id]).filter((companion) => companion?.id),
    [companionIds, companionsById]
  );

  const [reminders, setReminders] = useState<CareReminder[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reminderType, setReminderType] = useState<CareReminderType>('ANNUAL_CHECKUP');
  const [dueDate, setDueDate] = useState('');
  const [sendAt, setSendAt] = useState('');
  const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);
  const loading = Boolean(organisationId && loadedOrgId !== organisationId);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!organisationId) return;
    const rows = await listCareReminders(organisationId);
    setReminders(rows);
  }, [organisationId]);

  useEffect(() => {
    if (!organisationId) return;
    const load = async () => {
      try {
        await Promise.all([
          loadCompanionsForPrimaryOrg(),
          listCareReminders(organisationId).then(setReminders),
        ]);
      } catch (err: unknown) {
        logger.error('Failed to load care reminders', err);
        setError('Could not load care reminders. Please try again.');
      } finally {
        setLoadedOrgId(organisationId);
      }
    };
    void load();
  }, [organisationId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organisationId || !selectedIds.length || !dueDate) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await createCareReminders(organisationId, {
        patientIds: selectedIds,
        reminderType,
        dueDate: new Date(`${dueDate}T00:00:00`).toISOString(),
        ...(sendAt ? { sendAt: new Date(sendAt).toISOString() } : {}),
      });
      setSelectedIds([]);
      setDueDate('');
      setSendAt('');
      setNotice('Reminders scheduled.');
      await refresh();
    } catch (err) {
      logger.error('Failed to schedule care reminders', err);
      setError('Could not schedule these reminders. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async (reminderId: string) => {
    if (!organisationId) return;
    setSendingId(reminderId);
    setError(null);
    setNotice(null);
    try {
      await sendCareReminder(organisationId, reminderId);
      await refresh();
      setNotice('Delivery result updated.');
    } catch (err) {
      logger.error('Failed to send care reminder', err);
      setError('Could not send this reminder. Please try again.');
    } finally {
      setSendingId(null);
    }
  };

  const namesById = useMemo(
    () => Object.fromEntries(companions.map((companion) => [companion.id, companion.name])),
    [companions]
  );

  let reminderContent;
  if (!organisationId) {
    reminderContent = (
      <p className="rounded-xl border border-dashed border-[var(--color-neutral-300)] bg-[var(--color-surface-card)] p-8 text-center text-sm text-[var(--color-neutral-600)]">
        Select a practice to view care reminders.
      </p>
    );
  } else if (loading) {
    reminderContent = (
      <p
        role="status"
        className="rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-surface-card)] p-6 text-sm"
      >
        Loading reminders…
      </p>
    );
  } else if (reminders.length === 0) {
    reminderContent = (
      <p className="rounded-xl border border-dashed border-[var(--color-neutral-300)] bg-[var(--color-surface-card)] p-8 text-center text-sm text-[var(--color-neutral-600)]">
        No care reminders yet.
      </p>
    );
  } else {
    reminderContent = (
      <ul className="space-y-3">
        {reminders.map((reminder) => {
          const type =
            REMINDER_TYPES.find((item) => item.value === reminder.reminderType)?.label ??
            'Care reminder';
          return (
            <li
              key={reminder.id}
              className="rounded-2xl border border-[var(--color-neutral-200)] bg-[var(--color-surface-card)] p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {namesById[reminder.patientId] ?? 'Companion'} · {type}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
                    Due {formatDate(reminder.dueDate)}
                    {reminder.sendAt ? ` · sends ${formatDate(reminder.sendAt)}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--color-neutral-100)] px-3 py-1 text-xs font-medium">
                  {statusLabel(reminder)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-neutral-100)] pt-3">
                <div>
                  <p className="text-sm">{deliveryText(reminder)}</p>
                  {reminder.lastAttemptAt && (
                    <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
                      Last attempt {formatDate(reminder.lastAttemptAt)}
                    </p>
                  )}
                </div>
                {reminder.status === 'PENDING' && (
                  <PermissionGate anyOf={[PERMISSIONS.APPOINTMENTS_EDIT_ANY]}>
                    <button
                      type="button"
                      disabled={sendingId === reminder.id}
                      onClick={() => void sendNow(reminder.id)}
                      className="rounded-lg border border-[var(--color-primary-700)] px-3 py-2 text-sm font-medium text-[var(--color-primary-700)] disabled:opacity-50"
                    >
                      {sendButtonLabel(reminder, sendingId)}
                    </button>
                  </PermissionGate>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 text-[var(--color-neutral-900)] sm:px-6">
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary-700)]">
          Patient care
        </p>
        <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
          Care reminders
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-neutral-600)]">
          Plan upcoming care, review who will receive each reminder, and see the result for every
          delivery channel.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section
          className="rounded-2xl border border-[var(--color-neutral-200)] bg-[var(--color-surface-card)] p-5 shadow-sm sm:p-6"
          aria-labelledby="schedule-heading"
        >
          <h2 id="schedule-heading" className="font-heading text-xl font-medium">
            Schedule care
          </h2>
          <p className="mb-5 mt-1 text-sm text-[var(--color-neutral-600)]">
            Choose companions and review the recipient list before saving.
          </p>
          <PermissionGate
            anyOf={[PERMISSIONS.APPOINTMENTS_EDIT_ANY]}
            fallback={
              <p className="text-sm text-[var(--color-neutral-600)]">
                You can view reminders but do not have permission to schedule them.
              </p>
            }
          >
            <form className="space-y-4" onSubmit={submit}>
              <label className="block text-sm font-medium" htmlFor="care-recipients">
                Companions
              </label>
              <select
                id="care-recipients"
                multiple
                value={selectedIds}
                onChange={(event) =>
                  setSelectedIds(
                    Array.from(event.target.selectedOptions, (option) => option.value).slice(0, 200)
                  )
                }
                className="min-h-36 w-full rounded-xl border border-[var(--color-neutral-300)] bg-[var(--color-neutral-0)] p-3 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-primary-700)]"
                aria-describedby="recipient-review"
              >
                {companions.map((companion) => (
                  <option key={companion.id} value={companion.id}>
                    {companion.name}
                  </option>
                ))}
              </select>
              <p id="recipient-review" className="text-sm text-[var(--color-neutral-600)]">
                {selectedIds.length
                  ? `Selected (${selectedIds.length}): ${selectedIds.map((id) => namesById[id]).join(', ')}`
                  : 'No recipients selected.'}
              </p>
              <label className="block text-sm font-medium" htmlFor="care-type">
                Care type
              </label>
              <select
                id="care-type"
                value={reminderType}
                onChange={(event) => setReminderType(event.target.value as CareReminderType)}
                className="w-full rounded-xl border border-[var(--color-neutral-300)] bg-[var(--color-neutral-0)] p-3 text-sm"
              >
                {REMINDER_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Care due date
                  <input
                    required
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-[var(--color-neutral-300)] bg-[var(--color-neutral-0)] p-3 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Send at (optional)
                  <input
                    type="datetime-local"
                    value={sendAt}
                    onChange={(event) => setSendAt(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-[var(--color-neutral-300)] bg-[var(--color-neutral-0)] p-3 text-sm"
                  />
                </label>
              </div>
              <Primary
                text={scheduleButtonLabel(saving, selectedIds.length)}
                isDisabled={saving || !selectedIds.length || !dueDate}
              />
            </form>
          </PermissionGate>
        </section>

        <section aria-labelledby="reminders-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="reminders-heading" className="font-heading text-xl font-medium">
                Scheduled and recent
              </h2>
              <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
                Delivery outcomes remain visible after refreshing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => refresh().catch(() => setError('Could not refresh reminders.'))}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-neutral-100)]"
            >
              Refresh
            </button>
          </div>
          {reminderContent}
        </section>
      </div>
    </div>
  );
};

export default CareRemindersPage;
