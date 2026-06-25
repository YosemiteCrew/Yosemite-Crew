import { LuShieldAlert, LuCalendar } from 'react-icons/lu';
import type { Appointment } from '@yosemite-crew/types';
import Text from '@/app/ui/Text';

/**
 * Clinical context rendered under the chat header for a pet-parent (appointment)
 * conversation: a safety allergy/alert bar (from the companion record) and an
 * in-person appointment banner with quick actions. Data is sourced from the
 * already-loaded companion/appointment stores; quick actions deep-link into the
 * existing appointment/forms workflows.
 */

type ClinicalAlert = { title?: string; severity: 'critical' | 'high' | 'medium' | 'low' };

const APPT_ACTIONS = ['Reschedule', 'Send form', 'Mark complete', 'Book follow-up'] as const;

export type ChatHeaderContextProps = Readonly<{
  allergy?: string;
  alerts?: ClinicalAlert[];
  appointment?: Appointment;
  onAction: (action: string) => void;
}>;

export function ChatHeaderContext({
  allergy,
  alerts,
  appointment,
  onAction,
}: ChatHeaderContextProps) {
  const flags: string[] = [];
  if (allergy) flags.push(`Allergy: ${allergy}`);
  for (const a of alerts ?? []) {
    if ((a.severity === 'critical' || a.severity === 'high') && a.title) flags.push(a.title);
  }

  const apptTime = appointment?.startTime ? new Date(appointment.startTime) : undefined;
  const apptLabel = apptTime
    ? apptTime.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : undefined;
  const apptName = appointment?.patient?.name ?? appointment?.companion?.name;

  if (flags.length === 0 && !appointment) return null;

  return (
    <div className="shrink-0">
      {flags.length > 0 && (
        <div className="flex items-center gap-2 border-b border-danger-200 bg-danger-soft px-4 py-2">
          <LuShieldAlert className="h-4 w-4 shrink-0 text-danger-600" />
          <Text as="span" variant="caption-1" className="font-semibold text-danger-600">
            {flags.join(' · ')}
          </Text>
        </div>
      )}
      {appointment && (
        <div className="flex flex-col gap-3 border-b border-chat-divider bg-chat-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-0 text-primary-600">
              <LuCalendar className="h-5 w-5" />
            </span>
            <div className="flex min-w-0 flex-col">
              <Text as="span" variant="body-4-emphasis" className="text-neutral-900">
                Appointment
              </Text>
              <Text as="span" variant="caption-1" className="truncate text-neutral-600">
                {[apptLabel, apptName].filter(Boolean).join(' · ') || 'Linked appointment'}
              </Text>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {APPT_ACTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onAction(a)}
                className="rounded-full border border-chat-panel-border bg-neutral-0 px-3 py-1 text-xs font-semibold text-primary-700 transition-colors hover:bg-chat-surface-soft"
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatHeaderContext;
