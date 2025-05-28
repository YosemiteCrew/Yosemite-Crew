const medicalRecords = require('../models/MedicalRecords');
const helpers = require('../utils/helpers');
const { mongoose } = require('mongoose');

class FHIRMedicalRecordService{
static convertFHIRToMedicalRecord(fhirData: any) {
    // Basic validation: FHIR resourceType and essential fields
    if (!fhirData || typeof fhirData !== 'object') {
        throw new Error("Invalid FHIR data format.");
    }

    // Ensure it's a FHIR DocumentReference
    if (fhirData.resourceType !== 'DocumentReference') {
        throw new Error("Unsupported FHIR resourceType. Expected 'DocumentReference'.");
    }

    // Extract and validate fields from FHIR format
    const documentType = fhirData.type?.text;
    const title = fhirData.description;
    const issueDate = fhirData.date; // FHIR `date` typically used for issue
    const expiryDate = fhirData.context?.period?.end;
    const patientId = fhirData.subject?.reference?.split('/')?.[1];

    if (!documentType) {
        throw new Error("Missing required FHIR field: type.text");
    }

    if (!title) {
        throw new Error("Missing required FHIR field: description");
    }

    if (!patientId) {
        throw new Error("Missing or invalid FHIR field: subject.reference");
    }

    // Return normalized object for DB saving
    return {
        documentType,
        title,
        issueDate,
        expiryDate,
        patientId
    };
}

    
    // NEW: Convert saved record to FHIR format
   static convertMedicalRecordToFHIR(record: any) {
    if (!record) throw new Error("Invalid medical record.");

    return {
        resourceType: "DocumentReference",
        id: record._id?.toString() || record.id,
        status: "current",

        type: {
            text: record.documentType
        },

        description: record.title,

        date: record.issueDate,

        subject: {
            identifier: {
                value: record.userId
            },
            reference: record.petId ? `Patient/${record.petId}` : undefined
        },

        context: record.hasExpiryDate
          ? {
              period: {
                end: record.expiryDate
              }
            }
          : {
              period: {
                end: "" // or null, or omit entirely depending on your needs
              }
            },

        content: Array.isArray(record.medicalDocs) && record.medicalDocs.length > 0
            ? record.medicalDocs.map(doc => ({
                attachment: {
                    url: doc.url || '',
                    title: doc.originalname || '',
                    contentType: doc.mimetype || 'application/pdf'
                }
            }))
            : [],

        extension: [
            {
                url: "http://example.org/fhir/StructureDefinition/has-expiry-date",
                valueBoolean: record.hasExpiryDate
            },
        ]
    };
}

    static async deleteMedicalRecord(id) {
        const objectId = new mongoose.Types.ObjectId(id); 
        const data = await medicalRecords.find({ _id: objectId });
      
        if (data.length === 0) {
          return null; // Return null if not found
        }
      
        if (Array.isArray(data[0].medicalDocs) && data[0].medicalDocs.length > 0) {
          const medicalDocs = data[0].medicalDocs;
      
          for (const docs of medicalDocs) {
            if (docs.url) {
              await helpers.deleteFiles(docs.url);
            }
          }
        }
      
        return await medicalRecords.deleteOne({ _id: objectId });
      }

}
module.exports = FHIRMedicalRecordService;