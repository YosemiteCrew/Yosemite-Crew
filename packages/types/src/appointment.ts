export type AppointmentStatus =
  | 'BOOKED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export type Appointment = {
  _id?: string;
  userId: string;              // Vet or practitioner being booked
  organisationId: string;      // Org / clinic
  companionId: string;         // pet's id
  petOwnerId: string;          // Owner making booking
  startTime: Date;             // Booking start timestamp
  endTime: Date;               // Booking end timestamp
  status: AppointmentStatus;
  notes?: string;              // Optional
  createdAt?: Date;
  updatedAt?: Date;
};