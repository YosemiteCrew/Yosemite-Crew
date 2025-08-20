import { Request } from "express";
import { Types } from "mongoose";

export interface FHIRMedicalRecord {  
      documentType?: string;
      documentTypeId? : string,
      title : string,
      issueDate? : string,
      expiryDate? : string,
      patientId : string,
      createdByRole:string

}
export type FhirDocumentReference = {
  resourceType: string;
  type: {
    text: string;
    reference?: string;
  };
  description: string;
  date?: string;
  context?: {
    period?: {
      end?: string;
    };
  };
  subject: {
    reference: string; // format: "Patient/123"
  };
  [key: string]: any; // for other FHIR fields
};


export interface MedicalRecordRequestBody {
    data:string
}

export interface MedicalRecordResponse {
    resourceType:string;
    id:string;
    status:string;
    type: {
        text?: string;
    };
    description?: string;
    date?: string,
    context: {
        period: {
            end?: string;
        };
    };
    subject: {
        identifier: {
            value: string;
        };
        reference?: string;
        image?:string;
    };
    content?:{
        attachment:{
            url:string, 
            title: string,
            contentType: string
        };
    }[];
    extension:{
        url: string;
        valueBoolean?: string;
    }[];
    effectiveDateTime:Date
    }

    export interface MedicalDoc {
        attachment:{
            url:string, 
            title: string,
            contentType: string

        }
    }

    export interface MedicalRecordFolderRequest extends Request {
  body: {
    userId: string;
    specialty: string;
    caseFolderName: string;
  }
}