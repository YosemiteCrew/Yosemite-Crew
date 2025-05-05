const medicalRecords = require('../models/medical');
const PetService = require('../services/PetService');
const FHIRMedicalRecordService = require('../services/FHIRMedicalRecordService');

async function handlesaveMedicalRecord(req,res) {

    try {
        // Expecting all params in one field: data (FHIR format)
    const fhirData = req.body.data;

    if (!fhirData) {
      return res.status(400).json({
        message: "Missing data field",
        error: "FHIR data is required in 'data' field",
      });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(fhirData);
    } catch (err) {
      return res.status(400).json({
        message: "Invalid JSON",
        error: "Unable to parse 'data' field as JSON",
      });
    }

    // FHIR to internal model conversion
    const medicalData = await FHIRMedicalRecordService.convertFHIRToMedicalRecord(parsedData);
   
        if (
            !medicalData.documentType ||
            !medicalData.title
        ) {
            return res.status(400).json({
                message: "Validation failed",
                error: "Fields documentType, title, issueDate, and expiryDate are required.",
            });
        }
        if (!req.user || !req.user.username) {
            return res.status(401).json({
                message: "Unauthorized",
                error: "username not found in token",
            });
        }
        // Optional Date Validations
        let issueDate = null;
        let expiryDate = null;

        if (medicalData.issueDate) {
        issueDate = new Date(medicalData.issueDate);
        if (isNaN(issueDate.getTime())) {
            return res.status(400).json({
            message: "Invalid issueDate",
            error: "issueDate must be a valid date",
            });
        }
        }

        if (medicalData.expiryDate) {
        expiryDate = new Date(medicalData.expiryDate);
        if (isNaN(expiryDate.getTime())) {
            return res.status(400).json({
            message: "Invalid expiryDate",
            error: "expiryDate must be a valid date",
            });
        }
        }

        // If both dates are present, check logical order
        if (issueDate && expiryDate && expiryDate < issueDate) {
        return res.status(400).json({
            message: "Date validation failed",
            error: "expiryDate cannot be earlier than issueDate",
        });
        }

        const [medicalDocs] = await Promise.all([
            req.files ? PetService.uploadFiles(req.files.files) : Promise.resolve([]),
        ]);
        

        const addMedicalRecords = await medicalRecords.create({
            userId: req.user.username, // Extracted from token
            documentType: medicalData.documentType,
            title: medicalData.title,
            issueDate: medicalData.issueDate,
            expiryDate: medicalData.expiryDate,
            medicalDocs: medicalDocs,
        });

        const fhirResponse = FHIRMedicalRecordService.convertMedicalRecordToFHIR(addMedicalRecords);

        return res.status(200).json({ status: 1, data: fhirResponse});

        // return res.status(201).json({
        // message: "Medical record saved successfully",
        // medicalRecord: {
        //     id: addMedicalRecords.id,
        // },
        // });
    } catch (error) { 
        console.error("SaveMedicalRecord Error:", error);

        if (error.name === "ValidationError") {
            return res.status(400).json({
              message: "Mongoose validation failed",
              errors: error.errors,
            });
        } 
        return res.status(500).json({
            message: "Internal server error",
            error: error.message,
        });
    }
}

async function handleMedicalRecordList(req, res) {
    if (!req.user || !req.user.username) {
        return res.status(401).json({
            message: "Unauthorized",
            error: "username not found in token",
        });
    }

    const userid = req.user.username;
    const result = await medicalRecords.find({ userId: { $eq: userid } });

    if (result.length === 0) {
        return res.status(404).json({ message: "No Medical record found for this user" });
    }

    const fhirRecords = result.map(record => 
        FHIRMedicalRecordService.convertMedicalRecordToFHIR(record)
    );

    return res.status(200).json({
        resourceType: "Bundle",
        type: "searchset",
        total: fhirRecords.length,
        entry: fhirRecords.map(resource => ({ resource }))
    });
}


module.exports = {
    handlesaveMedicalRecord,
    handleMedicalRecordList,
}