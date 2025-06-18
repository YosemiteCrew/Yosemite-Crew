import  { Document } from 'mongoose';

export enum AnimalCategory {
  Dog = 'Dog',
  Cat = 'Cat',
  Horse = 'Horse',
}

// --- Breeds ---
export type IBreed = Document & {
  name: string;
  category: AnimalCategory;
};
// --- Purpose of Visits ---
export type IPurposeOfVisit = Document & {
  HospitalId: string;
  name: string;
};
// --- Appointment Types ---
export type IAppointmentType = Document & {
  HospitalId: string;
  name: string;
  category: AnimalCategory;
};
