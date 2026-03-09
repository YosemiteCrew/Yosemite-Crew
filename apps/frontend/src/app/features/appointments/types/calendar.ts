import { Appointment } from '@yosemite-crew/types';

export type LaidOutEvent = Appointment & {
  topPx: number;
  heightPx: number;
  columnIndex: number;
  columnsCount: number;
};

export type AppointmentViewIntent = {
  label: 'info' | 'prescription' | 'care' | 'tasks' | 'finance' | 'labs';
  subLabel?: string;
};

export type AppointmentDraftPrefill = {
  date: Date;
  minuteOfDay: number;
  leadId?: string;
};
