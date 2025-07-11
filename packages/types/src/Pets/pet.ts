export interface Pet {
  _id: string | { toString(): string };
  petName: string;
  petGender: string;
  petdateofBirth: string;
  petType: string;
  petBreed: string;
  isNeutered: string; // "Yes" | "No"
  petAge: number;
  petCurrentWeight: string;
  petColor: string;
  petBloodGroup: string;
  ageWhenNeutered: string;
  microChipNumber: string;
  isInsured: boolean;
  insuranceCompany: string;
  policyNumber: string;
  passportNumber: string;
  petFrom: string;
  petImage: string[];
  updatedAt: string;
}