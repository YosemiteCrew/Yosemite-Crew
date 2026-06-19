import { Appointment } from '@yosemite-crew/types';
import { Slot } from '@/app/features/appointments/types/appointments';
import { getAppointmentCompanion } from '@/app/lib/appointments';

export type AppointmentCentralFieldKey =
  | 'patient'
  | 'client'
  | 'speciality'
  | 'service'
  | 'chiefComplaint'
  | 'date'
  | 'time'
  | 'slot'
  | 'lead'
  | 'support'
  | 'typeOfVisit'
  | 'notifyVia'
  | 'emergency';

export type VisitType = 'Outpatient' | 'Inpatient';
export type NotifyChannel = 'app' | 'sms' | 'email';

export const VISIT_TYPE_OPTIONS: Array<{ label: string; value: VisitType }> = [
  { label: 'Outpatient', value: 'Outpatient' },
  { label: 'Inpatient', value: 'Inpatient' },
];

export const computeEstimate = (cost: unknown): number => Math.max(0, Number(cost) || 0);

export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts.at(-1)!.charAt(0)).toUpperCase();
};

export const hasUnsavedCentralChanges = (
  formData: Appointment,
  selectedSlot: Slot | null
): boolean =>
  Boolean(
    getAppointmentCompanion(formData).id ||
    formData.appointmentType?.speciality?.id ||
    formData.appointmentType?.id ||
    formData.concern?.trim() ||
    selectedSlot ||
    formData.lead?.id ||
    (formData.supportStaff?.length ?? 0) > 0 ||
    formData.isEmergency
  );
