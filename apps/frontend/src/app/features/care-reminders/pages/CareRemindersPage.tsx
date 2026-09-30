'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Primary } from '@/app/ui/primitives/Buttons';
import CareReminderList, { REMINDER_TYPES } from './CareReminderList';
import PermissionGate from '@/app/ui/layout/guards/PermissionGate';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { PERMISSIONS } from '@/app/lib/permissions';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { logger } from '@/app/lib/logger';
import { buildDateInPreferredTimeZone, buildPreferredTimeZoneDayInstant } from '@/app/lib/timezone';
import {
  createCareReminders,
  listCareReminders,
  sendCareReminder,
  type CareReminder,
  type CareReminderType,
} from '@/app/services/careReminderService';

const EMPTY_COMPANION_IDS: string[] = [];

// A date input gives a calendar day and a datetime-local input a wall-clock
// time. Both are read in the practice's preferred time zone, so the day staff
// pick is the day the owner sees wherever the browser's own clock is set.
const calendarDayInstant = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return buildPreferredTimeZoneDayInstant(year, month, day);
};

const wallClockInstant = (value: string) => {
  const [date, time] = value.split('T');
  const [hours, minutes] = time.split(':').map(Number);
  return buildDateInPreferredTimeZone(calendarDayInstant(date), hours * 60 + minutes);
};

const scheduleButtonLabel = (saving: boolean, count: number) => {
  if (saving) return 'Scheduling…';
  return count === 1 ? 'Schedule 1 reminder' : `Schedule ${count || ''} reminders`;
};

export const CareRemindersPage = () => {
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const companionIds = useCompanionStore((state) =>
    organisationId
      ? (state.companionsIdsByOrgId[organisationId] ?? EMPTY_COMPANION_IDS)
      : EMPTY_COMPANION_IDS
  );
  const companionsById = useCompanionStore((state) => state.companionsById);
  const companions = useMemo(
    () =>
      companionIds.flatMap((id) => {
        const companion = companionsById[id];
        return companion?.id ? [companion] : [];
      }),
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
        dueDate: calendarDayInstant(dueDate).toISOString(),
        ...(sendAt ? { sendAt: wallClockInstant(sendAt).toISOString() } : {}),
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
          className="mb-5 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]"
        >
          {error}
        </p>
      )}
      {notice && (
        <output className="mb-5 block rounded-xl border border-[var(--status-completed-border)] bg-[var(--status-completed-bg)] p-3 text-sm text-[var(--success-text)]">
          {notice}
        </output>
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
                  <span>Care due date</span>
                  <input
                    required
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-[var(--color-neutral-300)] bg-[var(--color-neutral-0)] p-3 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium">
                  <span>Send at (optional)</span>
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
          <CareReminderList
            organisationId={organisationId}
            loading={loading}
            reminders={reminders}
            namesById={namesById}
            sendingId={sendingId}
            onSend={(reminderId) => void sendNow(reminderId)}
          />
        </section>
      </div>
    </div>
  );
};

const ProtectedCareReminders = () => (
  <ProtectedRoute>
    <OrgGuard>
      <CareRemindersPage />
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedCareReminders;
