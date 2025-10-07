// types/fhir.ts

interface FHIRAttachment {
  contentType: string;
  title: string;
  url: string;
}

interface VaccineImageFile {
  url: string;
  originalname: string;
  mimetype: string;
}

export interface FHIRDocumentReference {
  resourceType: "DocumentReference";
  id: string;
  status: "current";
  type: {
    text: string;
  };
  content: [
    {
      attachment: FHIRAttachment;
    }
  ];
}

export interface FHIRImmunizationNote {
  text: string;
}

export interface FHIRImmunizationExtension {
  url: string;
  valueBoolean: boolean;
}

export interface FHIRImmunization {
  resourceType: "Immunization";
  id: string;
  status: "completed";
  patient: {
    reference: string;
    petImageUrl:string
  };
  vaccineCode: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
    text?: string;
  };
  lotNumber?: string;
  manufacturer?: {
    display: string;
  };
  occurrenceDateTime: string;
  location?: {
    display: string;
  };
  note?: FHIRImmunizationNote[];
  extension?: FHIRImmunizationExtension[];
  contained?: FHIRDocumentReference[];
  supportingInformation?: {
    reference: string;
  }[];
  petImageUrl?:VaccineImageFile[]
}

export interface FHIRBundle {
  resourceType: "Bundle";
  type: "collection";
  entry: {
    resource: FHIRImmunization;
  }[];
}

export interface BasicImmunizationResource {
  resourceType: 'Immunization';
  status: string;
  vaccineCode: {
    text?: string;
    coding?: {
      system: string;
      code: string;
      display: string;
    }[];
  };
  patient: {
    reference: string;
  };
  
  occurrenceDateTime: string;
  manufacturer: {
    display: string;
  };
  lotNumber: string;
  expirationDate: string;
  performer?: {
    actor?: {
      display?: string;
    };
  }[];
  location?:{
    display: string;
  };
  note?: {
    text: string;
  }[];
  extension?: {
    url: string;
    valueBoolean: boolean;
  }[];
}



export interface TransformedVaccination {
  userId: string;
  petId: string;
  manufacturerName: string;
  vaccineName: string;
  batchNumber: string;
  expiryDate: string;           // ISO date string
  vaccinationDate: string;      // ISO date string
  hospitalName: string;
  nextdueDate: string | null;   // ISO date string or null
  vaccineImage: VaccineImageFile[];
  reminder: boolean;
}


