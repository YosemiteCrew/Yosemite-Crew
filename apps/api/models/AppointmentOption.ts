import  {  Schema, model } from 'mongoose';
import {IBreed,IPurposeOfVisit,IAppointmentType} from "@yosemite-crew/types";

export enum AnimalCategory {
  Dog = 'Dog',
  Cat = 'Cat',
  Horse = 'Horse',
}
const BreedsSchema = new Schema<IBreed>({
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: Object.values(AnimalCategory),
  },
});

export const Breeds = model<IBreed>('Breeds', BreedsSchema);

const PurposeOfVisitsSchema = new Schema<IPurposeOfVisit>({
  HospitalId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
});

export const PurposeOfVisits = model<IPurposeOfVisit>(
  'PurposeOfVisits',
  PurposeOfVisitsSchema
);


const AppointmentTypeSchema = new Schema<IAppointmentType>({
  HospitalId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: Object.values(AnimalCategory),
  },
});

export const AppointmentType = model<IAppointmentType>(
  'AppointmentTypes',
  AppointmentTypeSchema
);
