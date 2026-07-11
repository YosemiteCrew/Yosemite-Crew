import { Appointment } from '@yosemite-crew/types';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import {
  clampMinutes,
  hasAppointmentConflict,
} from '@/app/features/appointments/components/Calendar/appointmentCalendarDragUtils';

type TeamMember = ReturnType<typeof useTeamForPrimaryOrg>[number];

type AppointmentMovePlanOptions = {
  allAppointments: Appointment[];
  appointmentId: string | null;
  buildStart: (date: Date, minuteOfDay: number) => Date;
  date: Date;
  isAppointmentDraggable: (appointment: Appointment) => boolean;
  minutesSinceMidnight: number;
  resolvePractitionerId: (candidateId?: string) => string | undefined;
  supportsSpeciality: (targetLeadId: string, appointment: Appointment) => boolean;
  targetLeadId?: string;
};

type AppointmentMovePayloadOptions = {
  appointment: Appointment;
  normalizeId: (value?: string) => string;
  nextEnd: Date;
  nextStart: Date;
  targetPractitionerId?: string;
  teams: TeamMember[];
};

export type AppointmentMovePlan = {
  appointment: Appointment;
  appointmentServiceId?: string;
  nextEnd: Date;
  nextStart: Date;
  snappedMinutes: number;
  targetPractitionerId?: string;
};

type AppointmentMovePlanResult =
  | { ok: true; plan: AppointmentMovePlan }
  | { ok: false; message?: string };

const getAppointmentDurationMs = (appointment: Appointment) =>
  Math.max(
    5 * 60 * 1000,
    new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()
  );

const getTeamMemberName = (
  teams: TeamMember[],
  targetPractitionerId: string,
  normalizeId: (value?: string) => string
) =>
  teams.find(
    (member) =>
      normalizeId(member.practionerId || '') === normalizeId(targetPractitionerId) ||
      normalizeId(member._id || '') === normalizeId(targetPractitionerId)
  )?.name;

export const createAppointmentMovePlan = ({
  allAppointments,
  appointmentId,
  buildStart,
  date,
  isAppointmentDraggable,
  minutesSinceMidnight,
  resolvePractitionerId,
  supportsSpeciality,
  targetLeadId,
}: AppointmentMovePlanOptions): AppointmentMovePlanResult => {
  if (!appointmentId) return { ok: false };
  const appointment = allAppointments.find((item) => item.id === appointmentId);
  if (!appointment) return { ok: false, message: 'Unable to move this appointment.' };
  if (!isAppointmentDraggable(appointment)) {
    return { ok: false, message: 'Only requested and upcoming appointments can be moved.' };
  }

  const snappedMinutes = clampMinutes(minutesSinceMidnight);
  const nextStart = buildStart(date, snappedMinutes);
  if (nextStart.getTime() < Date.now()) {
    return { ok: false, message: 'Cannot move an appointment to a past time.' };
  }
  if (targetLeadId && !supportsSpeciality(targetLeadId, appointment)) {
    return { ok: false, message: 'Selected team member is not configured for this speciality.' };
  }

  const nextEnd = new Date(nextStart.getTime() + getAppointmentDurationMs(appointment));
  const targetPractitionerId = resolvePractitionerId(targetLeadId || appointment.lead?.id);
  if (
    hasAppointmentConflict(appointment, nextStart, nextEnd, allAppointments, targetPractitionerId)
  ) {
    return { ok: false, message: 'Scheduling conflict detected with another appointment.' };
  }

  return {
    ok: true,
    plan: {
      appointment,
      appointmentServiceId: appointment.appointmentType?.id,
      nextEnd,
      nextStart,
      snappedMinutes,
      targetPractitionerId,
    },
  };
};

export const getMoveAvailabilityBlockMessage = async (
  plan: AppointmentMovePlan,
  date: Date,
  targetLeadId: string | undefined,
  ensureDragAvailability: (date: Date, targetLeadId?: string) => Promise<number[]>
) => {
  if (!plan.appointmentServiceId || !plan.targetPractitionerId) return null;
  const availableStartMinutes = await ensureDragAvailability(date, targetLeadId);
  return availableStartMinutes.includes(plan.snappedMinutes)
    ? null
    : 'No available slot for this service at the selected position.';
};

export const buildAppointmentMovePayload = ({
  appointment,
  normalizeId,
  nextEnd,
  nextStart,
  targetPractitionerId,
  teams,
}: AppointmentMovePayloadOptions) => ({
  ...appointment,
  lead: targetPractitionerId
    ? {
        id: targetPractitionerId,
        name:
          getTeamMemberName(teams, targetPractitionerId, normalizeId) ||
          appointment.lead?.name ||
          targetPractitionerId,
      }
    : appointment.lead,
  startTime: nextStart,
  endTime: nextEnd,
  appointmentDate: nextStart,
});
