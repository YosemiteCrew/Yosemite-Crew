import { Appointment } from '@yosemite-crew/types';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';

export type DragContext = {
  appointmentId: string;
  serviceId?: string;
  durationMinutes: number;
};

export type DragState = {
  appointmentId: string | null;
  label: string | null;
  error: string | null;
  context: DragContext | null;
  availabilityVersion: number;
};

export type DragAction =
  | { type: 'start'; appointmentId: string | null; label: string; context: DragContext }
  | { type: 'end' }
  | { type: 'setError'; error: string | null }
  | { type: 'availabilityRefreshed' };

export type ErrorCandidate =
  | { response?: { data?: unknown } }
  | { data?: unknown }
  | { message?: string };

export const initialDragState: DragState = {
  appointmentId: null,
  label: null,
  error: null,
  context: null,
  availabilityVersion: 0,
};

export const dragReducer = (state: DragState, action: DragAction): DragState => {
  switch (action.type) {
    case 'start':
      return {
        appointmentId: action.appointmentId,
        label: action.label,
        error: null,
        context: action.context,
        availabilityVersion: state.availabilityVersion + 1,
      };
    case 'end':
      return {
        ...state,
        appointmentId: null,
        label: null,
        context: null,
      };
    case 'setError':
      return {
        ...state,
        error: action.error,
      };
    case 'availabilityRefreshed':
      return {
        ...state,
        availabilityVersion: state.availabilityVersion + 1,
      };
    default:
      return state;
  }
};

const snapToStep = (minutes: number, step = 5) => Math.round(minutes / step) * step;

export const clampMinutes = (minutes: number) =>
  Math.max(0, Math.min(24 * 60 - 5, snapToStep(minutes)));

export const toLocalDayKey = (date: Date) =>
  formatDateInPreferredTimeZone(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

export const getDayOfWeekKey = (date: Date) =>
  formatDateInPreferredTimeZone(date, { weekday: 'long' }).toUpperCase();

export const getErrorMessageFromCandidate = (candidate: ErrorCandidate, fallback: string) => {
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  const getTrimmedMessage = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  const getResponseMessage = (value: unknown) => {
    const data = asRecord(value);
    if (!data) return getTrimmedMessage(value);
    return (
      getTrimmedMessage(data.message) ||
      getTrimmedMessage(data.error) ||
      getTrimmedMessage(data.details)
    );
  };

  const candidateRecord = asRecord(candidate);
  const responseRecord = asRecord(candidateRecord?.response);
  const responseData = responseRecord?.data;
  const candidateMessage = candidateRecord?.message;

  return getResponseMessage(responseData) || getTrimmedMessage(candidateMessage) || fallback;
};

export const getAppointmentDurationMinutes = (appointment: Appointment) =>
  Math.max(
    5,
    Math.round(
      (new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / 60000
    )
  );

export const getAppointmentDragLabel = (appointment: Appointment) =>
  formatCompanionNameWithOwnerLastName(
    appointment.companion?.name,
    appointment.companion?.parent,
    'Appointment'
  );

export const hasAppointmentConflict = (
  moved: Appointment,
  nextStart: Date,
  nextEnd: Date,
  sourceAppointments: Appointment[],
  targetLeadId?: string
) =>
  sourceAppointments.some((existing) => {
    if (!existing.id || existing.id === moved.id) return false;
    if (existing.status === 'CANCELLED' || existing.status === 'NO_SHOW') return false;
    const existingStart = new Date(existing.startTime);
    const existingEnd = new Date(existing.endTime);
    const overlaps =
      nextStart.getTime() < existingEnd.getTime() && nextEnd.getTime() > existingStart.getTime();
    if (!overlaps) return false;

    const movedLead = targetLeadId || moved.lead?.id;
    const existingLead = existing.lead?.id;
    const leadConflict = !!movedLead && movedLead === existingLead;

    const movedRoom = moved.room?.id;
    const existingRoom = existing.room?.id;
    const roomConflict = !!movedRoom && movedRoom === existingRoom;

    return leadConflict || roomConflict;
  });
