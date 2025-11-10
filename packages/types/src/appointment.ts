export type AppointmentStatus =
  | 'REQUESTED'
  | 'UPCOMING'
  | 'CHEKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type Appointment = {
  id: string;
  companion : {
    id: string;
    name: string;
    species: string;  
    breed: string;
    parent: {
      id: string;
      name: string;
    };
  }
  lead: {
    id: string;
    name: string;
  }                           // Vet or practitioner being booked
  supportStaff: {
    id: string;
    name: string;
  }[]
  room: {
    id: string;
    name: string;
  }
  organisationId: string;      // Org / clinic
  appointmentDate: Date;       // Date of the appointment
  timeSlot: string;            // Time Slot for the appointment
  durationMinutes: number;     // Duration in minutes
  endTime: Date;               // Booking end timestamp
  status: AppointmentStatus;
  concern?: string;            // Reason for the appointment
  createdAt?: Date;
  updatedAt?: Date;
};