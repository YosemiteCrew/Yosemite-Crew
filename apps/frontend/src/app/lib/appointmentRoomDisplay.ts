import type { Appointment, RoomUnit } from '@yosemite-crew/types';
import { resolveEncounterMode } from '@/app/lib/appointmentWorkspace';

export type AppointmentEncounterLookup = Record<string, { unitId?: string } | undefined>;
export type RoomUnitLookup = Record<
  string,
  | Pick<RoomUnit, 'displayName' | 'code'>
  | { name?: string; displayName?: string; code?: string }
  | undefined
>;

type AppointmentWithUnitFields = Appointment & {
  unitId?: string;
  roomUnitId?: string;
  unitName?: string;
  roomUnitName?: string;
  unit?: { id?: string; name?: string; displayName?: string; code?: string };
  room?: Appointment['room'] & {
    unitId?: string;
    roomUnitId?: string;
    unitName?: string;
    roomUnitName?: string;
    unit?: { id?: string; name?: string; displayName?: string; code?: string };
  };
};

type AppointmentRoomDisplay = {
  label: 'Room' | 'Room / Unit';
  roomName: string;
  unitLabel: string;
  value: string;
};

const getInlineUnitLabel = (appointment: AppointmentWithUnitFields): string => {
  const roomUnit = appointment.room?.unit;
  const directUnit = appointment.unit;
  return (
    appointment.room?.roomUnitName?.trim() ||
    appointment.room?.unitName?.trim() ||
    roomUnit?.displayName?.trim() ||
    roomUnit?.name?.trim() ||
    roomUnit?.code?.trim() ||
    appointment.roomUnitName?.trim() ||
    appointment.unitName?.trim() ||
    directUnit?.displayName?.trim() ||
    directUnit?.name?.trim() ||
    directUnit?.code?.trim() ||
    ''
  );
};

const getUnitId = (
  appointment: AppointmentWithUnitFields,
  encountersById: AppointmentEncounterLookup
): string => {
  const appointmentId = appointment.id ?? '';
  return (
    appointment.room?.roomUnitId?.trim() ||
    appointment.room?.unitId?.trim() ||
    appointment.room?.unit?.id?.trim() ||
    appointment.roomUnitId?.trim() ||
    appointment.unitId?.trim() ||
    appointment.unit?.id?.trim() ||
    encountersById[appointmentId]?.unitId?.trim() ||
    ''
  );
};

export const getAppointmentUnitLabel = (
  appointment: Appointment,
  encountersById: AppointmentEncounterLookup = {},
  roomUnitsById: RoomUnitLookup = {}
): string => {
  if (resolveEncounterMode(appointment) !== 'INPATIENT') return '';
  const appointmentWithUnit = appointment as AppointmentWithUnitFields;
  const inlineLabel = getInlineUnitLabel(appointmentWithUnit);
  if (inlineLabel) return inlineLabel;
  const unitId = getUnitId(appointmentWithUnit, encountersById);
  if (!unitId) return '';
  const unit = roomUnitsById[unitId];
  return unit?.displayName?.trim() || unit?.code?.trim() || unitId;
};

export const getAppointmentRoomDisplay = (
  appointment: Appointment,
  encountersById: AppointmentEncounterLookup = {},
  roomUnitsById: RoomUnitLookup = {}
): AppointmentRoomDisplay => {
  const roomName = appointment.room?.name?.trim() || '-';
  const unitLabel = getAppointmentUnitLabel(appointment, encountersById, roomUnitsById);
  return {
    label: unitLabel ? 'Room / Unit' : 'Room',
    roomName,
    unitLabel,
    value: unitLabel ? `${roomName} / ${unitLabel}` : roomName,
  };
};
