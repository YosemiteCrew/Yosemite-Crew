import { FHIRMedicalRecord, medicalRecord, MedicalRecordResponse , FhirDocumentReference} from "@yosemite-crew/types";
import mongoose from "mongoose";
import medicalRecords from "../models/medical-records-model";
import helpers from "../utils/helpers";


class FHIRMedicalRecordService {

  static convertFhirToMedicalRecord(fhirData: FhirDocumentReference): FHIRMedicalRecord {
  if (!fhirData || typeof fhirData !== 'object') {
    throw new Error("Invalid FHIR data format.");
  }

  if (!fhirData.resourceType) {
    throw new Error("Unsupported FHIR resourceType. Expected 'DocumentReference'.");
  }

  if (!fhirData.type || !fhirData.type.text) {
    throw new Error("Missing required FHIR field: type.text");
  }

  if (!fhirData.description) {
    throw new Error("Missing required FHIR field: description");
  }

  if (!fhirData.subject || !fhirData.subject.reference) {
    throw new Error("Missing or invalid FHIR field: subject.reference");
  }

  const documentType = fhirData.type.text as string;
  const title = fhirData.description as string;
  const issueDate = fhirData.date as string;
  const expiryDate = fhirData.context?.period?.end as string;
  const patientId = fhirData.subject.reference.split('/')[1] as string; // extract ID from "Patient/12345"

  return {
    documentType,
    title,
    issueDate,
    expiryDate,
    patientId,
  };
}




  static convertMedicalRecordToFHIR(record: medicalRecord): MedicalRecordResponse {
  if (!record) throw new Error("Invalid medical record.");

  const id:string  = record._id;
  if (!id) throw new Error("Medical record ID is required.");
  return {
    resourceType: "DocumentReference",
    id,
    status: "current",

    type: {
      text: record.documentType,
    },

    description: record.title,
    date: record.issueDate,

    subject: {
      identifier: {
        value: record.userId,
      },
      reference: record.petId ? `Patient/${record.petId}` : undefined,
      image: record?.petImage && typeof record.petImage === 'object' && 'url' in record.petImage
        ? (record.petImage as { url: string }).url
        : undefined
    },

    context: {
      period: {
        end: record.hasExpiryDate ? record.expiryDate : "",
      },
    },

    content: Array.isArray(record.medicalDocs) && record.medicalDocs.length > 0
      ? record.medicalDocs.map((doc) => ({
          attachment: {
            url: doc.url ?? '',
            title: doc.originalname ?? '',
            contentType: doc.mimetype ?? 'application/pdf',
          },
        }))
      : [],

    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/has-expiry-date",
        valueBoolean: record.hasExpiryDate,
      },
    ],
    effectiveDateTime: record.createdAt as Date,
  };
}

  static async deleteMedicalRecord(id: string): Promise<{deletedCount:number} | null> {
    const objectId = new mongoose.Types.ObjectId(id);
    const data = await medicalRecords.find({ _id: objectId });

    if (data.length === 0) {
      return null;
    }

    const docs = data[0].medicalDocs;
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        if (doc.url) {
          await helpers.deleteFiles(doc.url);
        }
      }
    }

    return await medicalRecords.deleteOne({ _id: objectId });
  }
}
export default FHIRMedicalRecordService;