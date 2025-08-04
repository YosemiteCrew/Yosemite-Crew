import { Request } from "express";

export interface FHIRMedicalRecord {  
      documentType : string,
      title : string,
      issueDate? : string,
      expiryDate? : string,
      patientId : string,

}

export interface MedicalRecordRequestBody {
    data:object
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