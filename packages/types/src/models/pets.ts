
import { Types, Document } from 'mongoose'

export interface petImage extends Document {
  url?: string;
  originalname?: string;
  mimetype?: string;
}

export type pets = Document & {
  _id?:Types.ObjectId;
  cognitoUserId?: string;
  petType?: string;
  petBreed?: string;
  petName?: string;
  petdateofBirth?: string;
  petGender?: string;
  petAge?: string;
  petCurrentWeight?: string;
  petColor?: string;
  petBloodGroup?: string;
  isNeutered?: string;
  ageWhenNeutered?: string;
  microChipNumber?: string;
  isInsured?: string;
  insuranceCompany?: string;
  policyNumber?: string;
  passportNumber?: string;
  petFrom?: string;
  petImage?: petImage;
  updatedAt ?: string;
};


export type fhirPetPatient = {
  resourceType: "Patient";
  id: string;
  name: { text: string }[];
  gender: string;
  birthDate: string;
  animal: {
    species: {
      coding: {
        system: string;
        code: string;
        display: string;
      }[];
    };
    breed: {
      text: string;
    };
    genderStatus: {
      coding: {
        system: string;
        code: string;
        display: string;
      }[];
    };
  };
  extension: Array<
    | {
        url: string;
        valueString?: string;
        valueInteger?: number;
        valueBoolean?: boolean;
      }
    | {
        url: string;
        extension: {
          url: string;
          valueString: string;
        }[];
      }
  >;
}