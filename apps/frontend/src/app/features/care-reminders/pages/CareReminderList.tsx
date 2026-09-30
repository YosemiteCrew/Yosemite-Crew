'use client';

import PermissionGate from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { formatDateTimeLocal, formatDisplayDate } from '@/app/lib/date';
import type {
  CareReminder,
  CareReminderStatus,
  CareReminderType,
} from '@/app/services/careReminderService';

export const REMINDER_TYPES: Array<{ value: CareReminderType; label: string }> = [
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

const STATUS_LABELS: Record<CareReminderStatus, string> = {
  PENDING: 'Pending',
  SENDING: 'Sending',
  SENT: 'Sent',
  RESPONDED: 'Responded',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

const deliveryText = (reminder: CareReminder) => {
  if (reminder.status === 'SENDING') return 'Delivery in progress';
  if (reminder.lastDelivery) {
    return `Push ${CHANNEL_LABELS[reminder.lastDelivery.push]} · Email ${CHANNEL_LABELS[reminder.lastDelivery.email]}`;
  }
  if (reminder.lastAttemptAt) {
    return 'The last send did not finish, so its result is unknown. Check with the owner before sending again.';
  }
  return 'Not sent yet';
};

const sendButtonLabel = (reminder: CareReminder, sendingId: string | null) => {
  if (sendingId === reminder.id) return 'Sending…';
  return reminder.lastAttemptAt ? 'Retry send' : 'Send now';
};

const CareReminderList = ({
  organisationId,
  loading,
  reminders,
  namesById,
  sendingId,
  onSend,
}: {
  organisationId: string | null;
  loading: boolean;
  reminders: CareReminder[];
  namesById: Record<string, string>;
  sendingId: string | null;
  onSend: (reminderId: string) => void;
}) => {
  if (!organisationId) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-neutral-300)] bg-[var(--color-surface-card)] p-8 text-center text-sm text-[var(--color-neutral-600)]">
        Select a practice to view care reminders.
      </p>
    );
  }
  if (loading) {
    return (
      <output className="block rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-surface-card)] p-6 text-sm">
        Loading reminders…
      </output>
    );
  }
  if (reminders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-neutral-300)] bg-[var(--color-surface-card)] p-8 text-center text-sm text-[var(--color-neutral-600)]">
        No care reminders yet.
      </p>
    );
  }

  return (
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
                  Due {formatDisplayDate(reminder.dueDate)}
                  {reminder.sendAt ? ` · sends ${formatDateTimeLocal(reminder.sendAt)}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-[var(--color-neutral-100)] px-3 py-1 text-xs font-medium">
                {STATUS_LABELS[reminder.status]}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-neutral-100)] pt-3">
              <div>
                <p className="text-sm">{deliveryText(reminder)}</p>
                {reminder.lastAttemptAt && (
                  <p className="mt-1 text-xs text-[var(--color-neutral-500)]">
                    Last attempt {formatDateTimeLocal(reminder.lastAttemptAt)}
                  </p>
                )}
              </div>
              {reminder.status === 'PENDING' && (
                <PermissionGate anyOf={[PERMISSIONS.APPOINTMENTS_EDIT_ANY]}>
                  <button
                    type="button"
                    disabled={sendingId === reminder.id}
                    onClick={() => onSend(reminder.id)}
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
};

export default CareReminderList;
