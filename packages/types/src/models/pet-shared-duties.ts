import { Document } from 'mongoose'
export type SharedPetDuties = Document & {
  _id?: string;
  petId: string;
  userId: string;
  ownerId: string;
  taskName?: string;
  taskDate?: Date;
  taskTime?: string;
  repeatTask?: string;
  taskReminder?: string;
  syncWithCalendar?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
