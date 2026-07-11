import { Appointment } from '@yosemite-crew/types';
import { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { Slot } from '@/app/features/appointments/types/appointments';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { hasAppointmentConflict } from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';

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
      if (minute < 0 || minute > 24 * 60 - 5) continue;
      const nextStart = params.buildStart(params.date, minute);
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
      minutesSet.add(minute);
    }
  }

  return Array.from(minutesSet).sort((a, b) => a - b);
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
