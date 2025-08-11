type UploadRecord = {
  fileName: string;
  fileType: string;
  fileUrl: string;
  uploadedAt: Date;
};

export type WebAppointmentType = Document & {
  userId?: string;
  tokenNumber?: string;
  ownerName?: string;
  petId?: string;
  petName?: string;
  purposeOfVisit: string;
  appointmentType?: string;
  appointmentSource?: string;
  department: string;
  veterinarian: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentTime24: string;
  day: string;
  hospitalId?: string;
  slotsId: string;
  passportNumber?: string;
  description?: string;
  cancelReason?: string;
  microChipNumber?: string;
  appointmentStatus?: string;
  isCanceled?: string;
  cancelledBy?: string;
  uploadRecords?: UploadRecord[];
};

export type AppointmentsTokenType = Document & {
  hospitalId: string;
  appointmentDate: string;
  tokenCounts: number;
  expireAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
export type TimeSlot ={
  _id: string;
  time: string; // e.g., "15:30"
  time24: string; // e.g., "15:30"
}

export type NormalizedAppointment = {
  hospitalId: string;
  HospitalName: string;
  ownerName: string;
  phone: string;
  addressline1: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  petName: string;
  petAge: string;
  petType: string;
  gender: string;
  breed: string;
  purposeOfVisit: string;
  appointmentType: string;
  appointmentSource: string;
  department: string;
  veterinarian: string;
  appointmentDate: string; // e.g., "2025-06-04"
  day: string; // e.g., "Wednesday"
  timeSlots: TimeSlot[];
}




 export type IUnavailableSlot = Document & {
  userId: string; // ID of the user who owns the slot
  date: string;        // e.g., "2025-07-23"
  day: string;         // e.g., "Wednesday"
  slots: string[];     // e.g., ["5:00 PM", "4:30 PM", ...]
}