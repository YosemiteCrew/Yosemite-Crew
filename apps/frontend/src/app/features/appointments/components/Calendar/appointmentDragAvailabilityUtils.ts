import { Appointment } from '@yosemite-crew/types';
import { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { Slot } from '@/app/features/appointments/types/appointments';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  clampMinutes,
  DragContext,
  hasAppointmentConflict,
  toLocalDayKey,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';
import { getWeekDays } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { buildDateInPreferredTimeZone } from '@/app/lib/timezone';

type TeamMember = ReturnType<typeof useTeamForPrimaryOrg>[number];

type NormalizeId = (value?: string) => string;

type ClockTime = {
  dayOffset: number;
  minutes: number;
};

type CollectValidMinutesParams = {
  allAppointments: Appointment[];
  appointment: Appointment;
  buildStart: (date: Date, minuteOfDay: number) => Date;
  date: Date;
  durationMinutes: number;
  durationMs: number;
  normalizeId: NormalizeId;
  nowMs: number;
  targetPractitionerId: string;
  toLocalClockFromUtcTime: (value: string) => ClockTime;
};

export const getSlotCacheKey = (serviceId: string, date: Date) =>
  `${serviceId}:${date.toISOString().slice(0, 10)}`;

export const buildAppointmentStartFromCalendarMinutes = (date: Date, minuteOfDay: number) =>
  buildDateInPreferredTimeZone(date, clampMinutes(minuteOfDay));

export const getAvailabilityKey = ({
  allAppointments,
  date,
  dragContext,
  normalizeId,
  resolvePractitionerId,
  targetLeadId,
}: {
  allAppointments: Appointment[];
  date: Date;
  dragContext: DragContext | null;
  normalizeId: NormalizeId;
  resolvePractitionerId: (candidateId?: string) => string | undefined;
  targetLeadId?: string;
}) => {
  const appointment = dragContext
    ? allAppointments.find((item) => item.id === dragContext.appointmentId)
    : null;
  const practitionerId = resolvePractitionerId(targetLeadId || appointment?.lead?.id);
  return `${toLocalDayKey(date)}:${normalizeId(practitionerId || '')}`;
};

export const getTeamMemberIdentityIds = (
  member: Partial<TeamMember> | undefined,
  normalizeId: NormalizeId
) =>
  [
    normalizeId(member?.practionerId),
    normalizeId(member?._id),
    normalizeId((member as any)?.userId),
    normalizeId((member as any)?.id),
    normalizeId((member as any)?.userOrganisation?.userId),
  ].filter(Boolean);

export const findTeamMemberByIdentity = (
  teams: ReturnType<typeof useTeamForPrimaryOrg>,
  targetId: string | undefined,
  normalizeId: NormalizeId
) => {
  const normalizedTarget = normalizeId(targetId);
  if (!normalizedTarget) return undefined;
  return teams.find((member) =>
    getTeamMemberIdentityIds(member, normalizeId).includes(normalizedTarget)
  );
};

// Resolve the canonical id used to key availability lookups for a candidate id,
// preferring the practitioner id and falling back through the member's other
// identity fields before returning the candidate unchanged.
export const resolveTeamMemberPrimaryId = (
  teams: ReturnType<typeof useTeamForPrimaryOrg>,
  candidateId: string | undefined,
  normalizeId: NormalizeId
) => {
  if (!candidateId) return '';
  const member = findTeamMemberByIdentity(teams, candidateId, normalizeId) as
    | Partial<TeamMember>
    | undefined;
  return (
    member?.practionerId ||
    (member as any)?.userId ||
    (member as any)?.id ||
    (member as any)?.userOrganisation?.userId ||
    member?._id ||
    candidateId
  );
};

// Build a normalized-id → display-name map across all identity ids of each team
// member, so any id variant resolves to the same name.
export const buildTeamMemberNameMap = (
  teams: ReturnType<typeof useTeamForPrimaryOrg>,
  normalizeId: NormalizeId
) => {
  const map: Record<string, string> = {};
  for (const member of teams) {
    const name = member.name || (member as any).displayName || '-';
    for (const normalized of getTeamMemberIdentityIds(member, normalizeId)) {
      map[normalized] = name;
    }
  }
  return map;
};

const getSlotMinuteBounds = (
  slot: Slot,
  durationMinutes: number,
  toLocalClockFromUtcTime: (value: string) => ClockTime
) => {
  const slotStartClock = toLocalClockFromUtcTime(slot.startTime);
  const slotEndClock = toLocalClockFromUtcTime(slot.endTime);
  const slotStartAbsoluteMinute = slotStartClock.dayOffset * 1440 + slotStartClock.minutes;
  let slotEndAbsoluteMinute = slotEndClock.dayOffset * 1440 + slotEndClock.minutes;
  if (slotEndAbsoluteMinute <= slotStartAbsoluteMinute) slotEndAbsoluteMinute += 1440;
  const latestStartAbsoluteMinute = slotEndAbsoluteMinute - durationMinutes;
  if (latestStartAbsoluteMinute < slotStartAbsoluteMinute) return null;
  return {
    startMinute: Math.ceil(slotStartAbsoluteMinute / 5) * 5,
    endMinute: Math.floor(latestStartAbsoluteMinute / 5) * 5,
  };
};

const isValidMoveStartMinute = (minute: number, params: CollectValidMinutesParams) => {
  if (minute < 0 || minute > 24 * 60 - 5) return false;
  const nextStart = params.buildStart(params.date, minute);
  if (nextStart.getTime() < params.nowMs) return false;
  const nextEnd = new Date(nextStart.getTime() + params.durationMs);
  return !hasAppointmentConflict(
    params.appointment,
    nextStart,
    nextEnd,
    params.allAppointments,
    params.targetPractitionerId
  );
};

export const collectValidMinutesForSlots = (slots: Slot[], params: CollectValidMinutesParams) => {
  const normalizedTargetPractitionerId = params.normalizeId(params.targetPractitionerId);
  const minutesSet = new Set<number>();

  for (const slot of slots) {
    const hasTargetVet = (slot.vetIds ?? []).some(
      (vetId) => params.normalizeId(vetId) === normalizedTargetPractitionerId
    );
    if (!hasTargetVet) continue;

    const bounds = getSlotMinuteBounds(
      slot,
      params.durationMinutes,
      params.toLocalClockFromUtcTime
    );
    if (!bounds) continue;

    for (let minute = bounds.startMinute; minute <= bounds.endMinute; minute += 5) {
      if (isValidMoveStartMinute(minute, params)) minutesSet.add(minute);
    }
  }

  return Array.from(minutesSet).sort((a, b) => a - b);
};

type ComputeAvailableStartMinutesOptions = {
  allAppointments: Appointment[];
  buildStart: (date: Date, minuteOfDay: number) => Date;
  date: Date;
  dragContext: DragContext | null;
  getSlots: (serviceId: string, date: Date) => Promise<Slot[]>;
  normalizeId: NormalizeId;
  resolvePractitionerId: (candidateId?: string) => string | undefined;
  supportsSpeciality: (targetLeadId: string, appointment: Appointment) => boolean;
  targetLeadId?: string;
  toLocalClockFromUtcTime: (value: string) => ClockTime;
};

export const computeAvailableStartMinutes = async ({
  allAppointments,
  buildStart,
  date,
  dragContext,
  getSlots,
  normalizeId,
  resolvePractitionerId,
  supportsSpeciality,
  targetLeadId,
  toLocalClockFromUtcTime,
}: ComputeAvailableStartMinutesOptions): Promise<number[]> => {
  if (!dragContext) return [];
  const appointment = allAppointments.find((item) => item.id === dragContext.appointmentId);
  if (!appointment) return [];
  if (targetLeadId && !supportsSpeciality(targetLeadId, appointment)) return [];
  const serviceId = dragContext.serviceId || appointment.appointmentType?.id;
  const targetPractitionerId = resolvePractitionerId(targetLeadId || appointment.lead?.id);
  if (!serviceId || !targetPractitionerId) return [];

  const slots = await getSlots(serviceId, date);
  const durationMs = Math.max(5 * 60 * 1000, dragContext.durationMinutes * 60 * 1000);
  return collectValidMinutesForSlots(slots, {
    allAppointments,
    appointment,
    buildStart,
    date,
    durationMinutes: dragContext.durationMinutes,
    durationMs,
    normalizeId,
    nowMs: Date.now(),
    targetPractitionerId,
    toLocalClockFromUtcTime,
  });
};

export type DragAvailabilityCaches = {
  results: Partial<Record<string, number[]>>;
  pending: Partial<Record<string, Promise<void>>>;
};

/**
 * Cache-and-dedupe wrapper around an availability computation: concurrent
 * callers for the same key share one in-flight promise, and failures resolve
 * to an empty availability so dragging never wedges on a network error.
 */
export const resolveDragAvailability = async (
  caches: DragAvailabilityCaches,
  key: string,
  compute: () => Promise<number[]>,
  onSettled: (error?: unknown) => void
): Promise<number[]> => {
  if (caches.results[key]) return caches.results[key];
  if (caches.pending[key]) {
    await caches.pending[key];
    return caches.results[key] ?? [];
  }
  const task = (async () => {
    try {
      caches.results[key] = await compute();
      onSettled();
    } catch (error) {
      caches.results[key] = [];
      onSettled(error);
    }
  })();
  caches.pending[key] = task;
  await task;
  delete caches.pending[key];
  return caches.results[key] ?? [];
};

export const buildDragPrefetchTargets = (
  activeCalendar: string,
  currentDate: Date,
  weekStart: Date,
  teams: ReturnType<typeof useTeamForPrimaryOrg>
): Array<{ date: Date; targetLeadId?: string }> => {
  if (activeCalendar === 'day') return [{ date: currentDate }];
  if (activeCalendar === 'week') return getWeekDays(weekStart).map((date) => ({ date }));
  if (activeCalendar === 'team') {
    return (teams || []).map((member) => ({
      date: currentDate,
      targetLeadId: member.practionerId || member._id,
    }));
  }
  return [];
};

export const buildDropAvailabilityIntervals = (starts: number[]): DropAvailabilityInterval[] => {
  if (!starts.length) return [];
  const intervals: DropAvailabilityInterval[] = [];
  let rangeStart = starts[0];
  let previous = starts[0];

  for (const current of starts.slice(1)) {
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
