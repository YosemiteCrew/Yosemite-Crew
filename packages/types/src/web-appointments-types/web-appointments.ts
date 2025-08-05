export type NormalPetData = {
  petId: string;
  petName: string;
  petImage: string;
  petParentId: string;
  petParentName?: string;
  microChipNumber?:string;
  passportNumber?:string
};


export type FhirPetResource = {
  resourceType: "Patient";
  id: string;
  name: { text: string }[];
  photo: { url: string }[];
  extension: {
    url: string;
    valueString: string;
  }[];
};


export type SearchPetsRequestBody = {
  names?: string;
  microChip?: string;
};

// Optional: define response structure (simplified for clarity)
export type OperationOutcomeIssue = {
  severity: "error" | "warning" | "information";
  code: string;
  details: { text: string };
};

export type OperationOutcome = {
  resourceType: "OperationOutcome";
  issue: OperationOutcomeIssue[];
};

export type PetResponse = {
  _id?:string
  petId: string;
  petName: string;
  petImage?: string;
  petParentId: string;
};
