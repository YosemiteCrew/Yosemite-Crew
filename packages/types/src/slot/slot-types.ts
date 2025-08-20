export interface TimeSlot {
  time: string;
  _id?:string
}

export interface DoctorSlotDocument {
  doctorId: string;
  duration: string; // Duration in minutes
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






// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Get Slots To Book Appointment Types >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>



export type Slot = {
  time: string;
  selected: boolean;
};

export type FhirSlot = {
  resourceType: "Slot";
  id: string;
  extension: {
    url: string;
    valueString: string;
  }[];
  status: "free" | "busy";
};

export interface ValidationIssue {   
  severity: "error" | "warning";   
  code: string;   
  details: {    
  text: string;   
};
}
export interface SlotRequest {   
  appointmentDate: string;   
  doctorId: string;   
  slotMonth?: string;   
  slotYear?: string;
}