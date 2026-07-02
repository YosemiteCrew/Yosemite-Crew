import { LuShieldAlert, LuCalendar } from 'react-icons/lu';
import type { Appointment } from '@yosemite-crew/types';
import Text from '@/app/ui/Text';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import { allowReschedule, canTransitionAppointmentStatus } from '@/app/lib/appointments';

/**
 * Clinical context rendered under the chat header for a pet-parent (appointment)
 * conversation: a safety allergy/alert bar (from the companion record) and an
 * in-person appointment banner with quick actions. Data is sourced from the
 * already-loaded companion/appointment stores; quick actions deep-link into the
 * existing appointment/forms workflows.
 */

type ClinicalAlert = { title?: string; severity: 'critical' | 'high' | 'medium' | 'low' };

const APPT_ACTIONS = ['Reschedule', 'Send form', 'Mark complete', 'Book follow-up'] as const;
type AppointmentAction = (typeof APPT_ACTIONS)[number];

const getVisibleAppointmentActions = (
  appointment?: Appointment,
  completing?: boolean
): AppointmentAction[] => {
  const status = appointment?.status;
  return APPT_ACTIONS.filter((action) => {
    if (action === 'Reschedule') return allowReschedule(status);
    if (action === 'Mark complete') {
      // Hide as soon as the completion is in flight so the button can't be
      // clicked twice while the status round-trip is still pending.
      return !completing && canTransitionAppointmentStatus(status, 'COMPLETED');
    }
    return true;
  });
};

export type ChatHeaderContextProps = Readonly<{
  allergy?: string;
  alerts?: ClinicalAlert[];
  appointment?: Appointment;
  /** True while a "Mark complete" request is in flight — hides that action. */
  completing?: boolean;
  onAction: (action: string) => void;
}>;

export function ChatHeaderContext({
  allergy,
  alerts,
  appointment,
  completing,
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
  const visibleActions = getVisibleAppointmentActions(appointment, completing);

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
        <div className="flex flex-col gap-2.5 border-b border-chat-divider bg-chat-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
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
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0">
            {visibleActions.map((a) => (
              <Secondary key={a} text={a} onClick={() => onAction(a)} className="shrink-0" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatHeaderContext;
