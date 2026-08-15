import type { Appointment } from '@yosemite-crew/types';

export type AvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

/**
 * Shared drag/drop and slot-creation props accepted by every appointment
 * calendar surface (day, user, and week views).
 */
export type AppointmentCalendarInteractionProps = {
  canEditAppointments: boolean;
  draggedAppointmentId?: string | null;
  draggedAppointmentLabel?: string | null;
  canDragAppointment?: (appointment: Appointment) => boolean;
  onAppointmentDragStart?: (appointment: Appointment) => void;
  onAppointmentDragEnd?: () => void;
  onAppointmentDropAt?: (date: Date, minuteOfDay: number, targetLeadId?: string) => void;
  onDragHoverTarget?: (date: Date, targetLeadId?: string) => void;
  onCreateAppointmentAt?: (date: Date, minuteOfDay: number, targetLeadId?: string) => void;
  getDropAvailabilityIntervals?: (date: Date, targetLeadId?: string) => AvailabilityInterval[];
  getVisibleAvailabilityIntervals?: (date: Date, targetLeadId?: string) => AvailabilityInterval[];
  draggedAppointmentDurationMinutes?: number;
  slotStepMinutes?: number;
  availabilityLoaded?: boolean;
  skipAutoScroll?: boolean;
};
