import { Types, Document } from 'mongoose';

export type plan = Document &{
  userId: number;
  petId: number;
  typeOfPlan?: string;
  condition?: string;
  weeksSinceSurgery?: string;
  mobilityLevel?: string;
  painLevel?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
