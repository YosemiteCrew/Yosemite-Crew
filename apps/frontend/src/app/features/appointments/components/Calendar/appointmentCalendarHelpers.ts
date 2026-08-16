import { Appointment } from '@yosemite-crew/types';
import { Team } from '@/app/features/organization/types/team';
import { Slot } from '@/app/features/appointments/types/appointments';
import {
  buildDateInPreferredTimeZone,
  formatDateInPreferredTimeZone,
  utcClockTimeToPreferredTimeZoneClock,
} from '@/app/lib/timezone';
import {
  DropAvailabilityInterval,
  resolveAvailabilityIntervalsForDay,
} from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { hasAppointmentConflict } from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';

export type DragContext = {
  appointmentId: string;
  serviceId?: string;
  durationMinutes: number;
};

export type DragUiState = {
  draggedAppointmentId: string | null;
  draggedAppointmentLabel: string | null;
  dragError: string | null;
  dragContext: DragContext | null;
};

export const INITIAL_DRAG_UI: DragUiState = {
  draggedAppointmentId: null,
  draggedAppointmentLabel: null,
  dragError: null,
  dragContext: null,
};

export const snapToStep = (minutes: number, step = 5) => Math.round(minutes / step) * step;
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
export const toLocalClockFromUtcTime = (utcTime: string) =>
  utcClockTimeToPreferredTimeZoneClock(utcTime);

// Single source of truth for these drag helpers lives in appointmentCalendarDragUtils.
export {
  getErrorMessageFromCandidate,
  teamSupportsSpeciality as supportsSpeciality,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';
export { hasAppointmentConflict };

export const normalizeId = (value?: string) =>
  String(value ?? '')
    .trim()
    .split('/')
    .pop()
    ?.toLowerCase() ?? '';

export const resolvePractitionerId = (teams: Team[], candidateId?: string) => {
  if (!candidateId) return undefined;
  const normalizedCandidate = normalizeId(candidateId);
  const match = teams.find(
    (member) =>
      normalizeId(member.practionerId || '') === normalizedCandidate ||
      normalizeId(member._id || '') === normalizedCandidate
  );
  return match?.practionerId || candidateId;
};

export const findCurrentUserPractitionerId = (teams: Team[], authUserId: string) => {
  const normalizedCurrentUser = normalizeId(authUserId);
  if (!normalizedCurrentUser) return undefined;
  const member = teams.find(
    (team) =>
      normalizeId(team.practionerId) === normalizedCurrentUser ||
      normalizeId(team._id) === normalizedCurrentUser ||
      normalizeId((team as any).userId) === normalizedCurrentUser ||
      normalizeId((team as any).id) === normalizedCurrentUser ||
      normalizeId((team as any).userOrganisation?.userId) === normalizedCurrentUser
  );
  return member?.practionerId || member?._id;
};

export const buildAppointmentStartFromCalendarMinutes = (date: Date, minuteOfDay: number) => {
  const clampedMinute = Math.max(0, Math.min(24 * 60 - 5, Math.round(minuteOfDay / 5) * 5));
  return buildDateInPreferredTimeZone(date, clampedMinute);
};

export const collectValidMinutesForSlot = (
  slot: Slot,
  params: {
    date: Date;
    appointment: Appointment;
    allAppointments: Appointment[];
    normalizedTargetPractitionerId: string;
    targetPractitionerId: string;
    durationMinutes: number;
    durationMs: number;
    nowMs: number;
    minutesSet: Set<number>;
  }
) => {
  const hasTargetVet = (slot.vetIds ?? []).some(
    (vetId) => normalizeId(vetId) === params.normalizedTargetPractitionerId
  );
  if (!hasTargetVet) return;
  const slotStartClock = toLocalClockFromUtcTime(slot.startTime);
  const slotEndClock = toLocalClockFromUtcTime(slot.endTime);
  const slotStartAbsoluteMinute = slotStartClock.dayOffset * 1440 + slotStartClock.minutes;
  let slotEndAbsoluteMinute = slotEndClock.dayOffset * 1440 + slotEndClock.minutes;
  if (slotEndAbsoluteMinute <= slotStartAbsoluteMinute) {
    slotEndAbsoluteMinute += 1440;
  }
  const latestStartAbsoluteMinute = slotEndAbsoluteMinute - params.durationMinutes;
  if (latestStartAbsoluteMinute < slotStartAbsoluteMinute) return;
  const startMinute = Math.ceil(slotStartAbsoluteMinute / 5) * 5;
  const endMinute = Math.floor(latestStartAbsoluteMinute / 5) * 5;
  for (let minute = startMinute; minute <= endMinute; minute += 5) {
    if (minute < 0 || minute > 24 * 60 - 5) continue;
    const nextStart = buildAppointmentStartFromCalendarMinutes(params.date, minute);
    if (nextStart.getTime() < params.nowMs) continue;
    const nextEnd = new Date(nextStart.getTime() + params.durationMs);
    if (
      hasAppointmentConflict(
        params.appointment,
        nextStart,
        nextEnd,
        params.allAppointments,
        params.targetPractitionerId
      )
    )
      continue;
    params.minutesSet.add(minute);
  }
};

export const resolveViewAvailabilityIntervals = (params: {
  date: Date;
  targetLeadId?: string;
  primaryOrgId: string | null;
  availabilityIdsByOrgId: Record<string, string[]>;
  availabilitiesById: Record<string, unknown>;
  teams: Team[];
}): DropAvailabilityInterval[] => {
  const { date, targetLeadId, primaryOrgId, availabilityIdsByOrgId, availabilitiesById, teams } =
    params;
  if (!primaryOrgId) return [];
  const dayKey = getDayOfWeekKey(date);
  const ids = availabilityIdsByOrgId[primaryOrgId] ?? [];
  const orgAvailabilities = ids.flatMap((id) => {
    const availability = availabilitiesById[id];
    return availability ? [availability] : [];
  });
  if (!orgAvailabilities.length) return [];

  const normalizedTarget = normalizeId(targetLeadId);
  const matchedTargetMember = normalizedTarget
    ? teams.find(
        (member) =>
          normalizeId(member.practionerId) === normalizedTarget ||
          normalizeId(member._id) === normalizedTarget ||
          normalizeId((member as any).userId) === normalizedTarget ||
          normalizeId((member as any).id) === normalizedTarget ||
          normalizeId((member as any).userOrganisation?.userId) === normalizedTarget
      )
    : null;
  const targetIds = normalizedTarget
    ? new Set(
        [
          normalizedTarget,
          normalizeId(matchedTargetMember?.practionerId),
          normalizeId(matchedTargetMember?._id),
          normalizeId((matchedTargetMember as any)?.userId),
          normalizeId((matchedTargetMember as any)?.id),
          normalizeId((matchedTargetMember as any)?.userOrganisation?.userId),
        ].filter(Boolean)
      )
    : undefined;

  return resolveAvailabilityIntervalsForDay({
    allEntries: orgAvailabilities as never,
    dayKey,
    targetIds,
    normalizeId,
    toLocalClockFromUtcTime: utcClockTimeToPreferredTimeZoneClock,
  });
};

export const buildDropIntervalsFromStarts = (starts: number[]): DropAvailabilityInterval[] => {
  if (!starts.length) return [];
  const intervals: DropAvailabilityInterval[] = [];
  let rangeStart = starts[0];
  let previous = starts[0];
  for (let i = 1; i < starts.length; i++) {
    const current = starts[i];
    if (current - previous === 5) {
      previous = current;
      continue;
    }
    intervals.push({ startMinute: rangeStart, endMinute: previous });
    rangeStart = current;
    previous = current;
  }
  intervals.push({ startMinute: rangeStart, endMinute: previous });
  return intervals;
};
