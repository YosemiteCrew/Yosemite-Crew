import { Types, Document } from 'mongoose'


export type diabetesRecords = Document & {
  userId: string;
  petId: string;
  recordDate?: Date;
  recordTime?: string;
  waterIntake?: string;
  foodIntake?: string;
  activityLevel?: string;
  urination?: string;
  signOfIllness?: string;
  bloodGlucose?: string;
  urineGlucose?: string;
  urineKetones?: string;
  weight?: string;
  bodyCondition?: {
    url: string;
    originalname: string;
    mimetype: string;
  }[];
}

export type DiabetesRecords = Document & {
  _id: string;
  userId: string;
  petId: string;
  recordDate?: string;
  recordTime?: string;
  waterIntake?: string;
  foodIntake?: string;
  activityLevel?: string;
  urination?: string;
  signOfIllness?: string;
  bloodGlucose?: string;
  urineGlucose?: string;
  urineKetones?: string;
  weight?: string;
  bodyCondition?: {
    url: string;
    originalname: string;
    mimetype: string;
  }[];
}
