import type {
  FHIRDocumentReference,
  FHIRImmunizationNote,
  FHIRImmunizationExtension,
  FHIRImmunization,
  FHIRBundle
} from "@yosemite-crew/types";


type VaccineImage = {
  mimetype: string;
  originalname: string;
  url: string;
};

export interface VaccinationDoc {
  _id: string | { toString(): string };
  petId: string;
  vaccineName?: string;
  batchNumber?: string;
  manufacturerName?: string;
  vaccinationDate: string;
  hospitalName?: string;
  nextdueDate: string;
  expiryDate: string;
  reminder: boolean;
  vaccineImage?: VaccineImage[];
  petImageUrl:string
}

export const toImmunizationResource = (vaccinationDoc: VaccinationDoc): FHIRImmunization => {

  const containedDocs: FHIRDocumentReference[] =
    vaccinationDoc?.vaccineImage?.map((img, index) => ({
      resourceType: "DocumentReference",
      id: `doc-${index + 1}`,
      status: "current",
      type: {
        text: "Vaccine Image"
      },
      content: [
        {
          attachment: {
            contentType: img.mimetype,
            title: img.originalname,
            url: img.url
          }
        }
      ]
    })) || [];

  const imageRefs: { reference: string }[] =
    vaccinationDoc?.vaccineImage?.map((_, index) => ({
      reference: `#doc-${index + 1}`
    })) || [];

  return {
    resourceType: "Immunization",
    id: typeof vaccinationDoc._id === "string" ? vaccinationDoc._id : vaccinationDoc._id.toString(),
    status: "completed",
    patient: {
      reference: `Patient/${vaccinationDoc.petId}`,
      petImageUrl:vaccinationDoc?.petImageUrl
    },
    vaccineCode: {
      coding: [
        {
          system: "http://hl7.org/fhir/sid/cvx",
          code: vaccinationDoc.vaccineName?.toUpperCase() || "UNKNOWN",
          display: vaccinationDoc.vaccineName || "UNKNOWN"
        }
      ],
      text: vaccinationDoc.vaccineName
    },
    lotNumber: vaccinationDoc.batchNumber,
    manufacturer: {
      display: vaccinationDoc.manufacturerName || "Unknown"
    },
    occurrenceDateTime: vaccinationDoc.vaccinationDate,
    location: {
      display: vaccinationDoc.hospitalName || "Unknown"
    },
    note: [
      {
        text: `Next due: ${new Date(vaccinationDoc.nextdueDate).toISOString()}`
      },
      {
        text: `Expiry date: ${new Date(vaccinationDoc.expiryDate).toISOString()}`
      }
    ],
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/immunization-reminder",
        valueBoolean: vaccinationDoc.reminder
      }
    ],
    contained: containedDocs,
    supportingInformation: imageRefs
  };
};

export const toFHIRBundleImmunization = (vaccinations: VaccinationDoc[]): FHIRBundle => {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: vaccinations.map(vacc => ({
      resource: toImmunizationResource(vacc)
    }))
  };
};
