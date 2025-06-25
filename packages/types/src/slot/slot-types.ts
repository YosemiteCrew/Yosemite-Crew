export interface TimeSlot {
  time: string;
}

export interface DoctorSlotDocument {
  doctorId: string;
  day: string;
  timeSlots: TimeSlot[];
}

export interface AppointmentDocument {
  appointmentDate: string;
  veterinarian: string;
}

export interface GetTimeSlotsInput {
  appointmentDate: string;
  doctorId: string;
}

export interface FHIRSlot {
  resourceType: string;
  start: string;
  [key: string]: any;
}

export interface FHIRSlotBundle {
  resourceType: 'Bundle';
  type: 'collection';
  entry: Array<{ resource: FHIRSlot }>;
}

export interface SlotQuery {
  appointmentDate?: string;
  doctorId?: string;
}

export interface MonthlySlotQuery {
  slotMonth?: string;
  slotYear?: string;
  doctorId?: string;
}
