class FHIRMedicalRecordService{
    static convertFHIRToMedicalRecord(fhirData) {
    
        // Basic validation: FHIR resourceType and essential fields
        if (!fhirData || typeof fhirData !== 'object') {
            throw new Error("Invalid FHIR data format.");
        }

        // Ensure it's a FHIR DocumentReference (you can adjust based on your FHIR resource)
        if (fhirData.resourceType !== 'DocumentReference') {
            throw new Error("Unsupported FHIR resourceType. Expected 'DocumentReference'.");
        }

        // Extract and validate fields from FHIR format
        const documentType = fhirData.type?.text;
        const title = fhirData.description;
        const issueDate = fhirData.date; // FHIR `date` typically used for issue
        const expiryDate = fhirData.context?.period?.end;

        if (!documentType) {
            throw new Error("Missing required FHIR field: type.text");
        }

        if (!title) {
            throw new Error("Missing required FHIR field: description");
        }

        // Return normalized object for DB saving
        return {
            documentType,
            title,
            issueDate,
            expiryDate,
        };
    }
    
    // NEW: Convert saved record to FHIR format
    static convertMedicalRecordToFHIR(record) {
        return {
            resourceType: "DocumentReference",
            id: record.id,
            status: "current",
            type: {
                text: record.documentType
            },
            subject: {
                identifier: {
                    value: record.userId
                }
            },
            date: record.issueDate,
            description: record.title,
            context: {
                period: {
                    end: record.expiryDate
                }
            },
            content: record.medicalDocs?.length > 0 ? record.medicalDocs.map(doc => ({
                attachment: {
                    url: doc.url || '',
                    title: doc.originalname || '',
                    contentType: doc.mimetype || 'application/pdf'
                }
            })) : []
        };
    }
}
module.exports = FHIRMedicalRecordService;