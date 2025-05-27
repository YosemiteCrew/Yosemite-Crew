const medicalRecords = require('../models/MedicalRecords');
const PetService = require('../services/PetService');
const FHIRMedicalRecordService = require('../services/FHIRMedicalRecordService');
const { mongoose } = require('mongoose');
const helpers = require('../utils/helpers');

class MedicalRecordsController{

static async handlesaveMedicalRecord(req,res) {

    try {
        // Expecting all params in one field: data (FHIR format)
    const fhirData = req.body.data;

    if (!fhirData) {
      return res.status(200).json({
        status: 0,
        message: "Missing data field",
        error: "FHIR data is required in 'data' field",
      });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(fhirData);
       
    } catch (err) {
      return res.status(200).json({
        status: 0,
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
            return res.status(200).json({
                status: 0,
                message: "Validation failed",
                error: "Fields documentType, title, issueDate, and expiryDate are required.",
            });
        }
        if (!req.user || !req.user.username) {
            return res.status(200).json({
                status: 0,
                message: "Unauthorized",
                error: "username not found in token",
            });
        }
        // Optional Date Validations
        let issueDate = null;
        let expiryDate = null;
        let hasExpiryDate = false;

        if (medicalData.issueDate) {
        issueDate = new Date(medicalData.issueDate);
        if (isNaN(issueDate.getTime())) {
            return res.status(200).json({
            status: 0,  
            message: "Invalid issueDate",
            error: "issueDate must be a valid date",
            });
        }
        }

        if (medicalData.expiryDate) {
        expiryDate = new Date(medicalData.expiryDate);
        hasExpiryDate = true;
        if (isNaN(expiryDate.getTime())) {
            return res.status(200).json({
            status: 0,
            message: "Invalid expiryDate",
            error: "expiryDate must be a valid date",
            });
        }
        }

        // If both dates are present, check logical order
        if (issueDate && expiryDate && expiryDate < issueDate) {
        return res.status(200).json({
            status: 0,
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
            petId:  medicalData.patientId,
            hasExpiryDate: hasExpiryDate,
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
            return res.status(200).json({
              status: 0,
              message: "Mongoose validation failed",
              errors: error.errors,
            });
        } 
        return res.status(200).json({
            status: 0,
            message: "Internal server error",
            error: error.message,
        });
    }
}

static async handleMedicalRecordList(req, res) {
    if (!req.user || !req.user.username) {
        return res.status(200).json({
            status: 0,
            message: "Unauthorized",
            error: "username not found in token",
        });
    }

    const userid = req.user.username;
    const result = await medicalRecords.find({ userId: { $eq: userid } });

    if (result.length === 0) {
        return res.status(200).json({ status: 0, message: "No Medical record found for this user" });
    }

    const fhirRecords = result.map(record => 
        FHIRMedicalRecordService.convertMedicalRecordToFHIR(record)
    );

    return res.status(200).json({
        status: 1,
        resourceType: "Bundle",
        type: "searchset",
        total: fhirRecords.length,
        entry: fhirRecords.map(resource => ({ resource }))
    });
}

 static async handleDeleteMedicalRecord(req, res) {
    try {
      const id = req.query.recordId;
  
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(200).json({ status: 0, message: "Invalid Medical Record ID" });
      }

      const result = await FHIRMedicalRecordService.deleteMedicalRecord(id);
  
      if (!result) {
        return res.status(200).json({ status: 0, message: "Medical record not found" });
      }
  
      if (result.deletedCount === 0) {
        return res.status(200).json({ status: 0, message: "Medical record could not be deleted" });
      }
  
      return res.status(200).json({ status: 1, message: "Medical record deleted successfully" });
  
    } catch (error) {
      return res.status(200).json({ status: 0, message: error.message });
    }
  }

  static async handleEditMedicalRecord(req, res) {
     try {
          const fhirData = req.body.data;
          const id = req.query.recordId;
          if (!mongoose.Types.ObjectId.isValid(id)) {
           throw new Error("Invalid ID format");
          }
      
          let parsedData;
          try {
            parsedData = JSON.parse(fhirData);
          } catch (e) {
            return res.status(200).json({ status: 0, message: "Invalid FHIR JSON data" });
          }
    
    // FHIR to internal model conversion
    const medicalData = await FHIRMedicalRecordService.convertFHIRToMedicalRecord(parsedData);

        if (
            !medicalData.documentType ||
            !medicalData.title
        ) {
            return res.status(200).json({
                status: 0,
                message: "Validation failed",
                error: "Fields documentType, title, issueDate, and expiryDate are required.",
            });
        }
        if (!req.user || !req.user.username) {
            return res.status(200).json({
                status: 0,
                message: "Unauthorized",
                error: "username not found in token",
            });
        }
        // Optional Date Validations
        let issueDate = null;
        let expiryDate = null;
        let hasExpiryDate = false;

        if (medicalData.issueDate) {
        issueDate = new Date(medicalData.issueDate);
        if (isNaN(issueDate.getTime())) {
            return res.status(200).json({
            status: 0,  
            message: "Invalid issueDate",
            error: "issueDate must be a valid date",
            });
        }
        }

        if (medicalData.expiryDate) {
        expiryDate = new Date(medicalData.expiryDate);
        hasExpiryDate = true;
        if (isNaN(expiryDate.getTime())) {
            return res.status(200).json({
            status: 0,
            message: "Invalid expiryDate",
            error: "expiryDate must be a valid date",
            });
        }
        }

        // If both dates are present, check logical order
        if (issueDate && expiryDate && expiryDate < issueDate) {
        return res.status(200).json({
            status: 0,
            message: "Date validation failed",
            error: "expiryDate cannot be earlier than issueDate",
        });
        }
      
          const fileArray = req.files?.files
            ? Array.isArray(req.files.files)
              ? req.files.files
              : [req.files.files]
            : [];
      
          let medicalFileUrl = null;
          let updatedMedicalRecords = null;
      
          // Upload files if present
          if (fileArray.length > 0) {
            medicalFileUrl = await helpers.uploadFiles(fileArray);
          }


      const updatedData = {
          documentType: medicalData.documentType,
          title: medicalData.title,
          issueDate: medicalData.issueDate, // FHIR `date` typically used for issue
          expiryDate: medicalData.expiryDate,
          hasExpiryDate: hasExpiryDate
       };

          
       if (medicalFileUrl) {
         // Use $push operator to add fileName to vaccineImage array
         updatedMedicalRecords =  await medicalRecords.findOneAndUpdate(
           { _id: id },
           {
             $set: updatedData,
             $push: { medicalDocs: medicalFileUrl }
           },
           { new: true }
         );
        } else {
          updatedMedicalRecords =  await medicalRecords.findOneAndUpdate(
            { _id: id },
            { $set: updatedData },
            { new: true }
          );
        }

        if (!updatedMedicalRecords) {
            return res.status(200).json({ status: 0, message: "Medical record not found" });
          }
      
          const fhirResponse = await FHIRMedicalRecordService.convertMedicalRecordToFHIR(updatedMedicalRecords);
      
          res.status(200).json({ status: 1, data: fhirResponse });
        } catch (error) {
          res.status(200).json({ status: 0, message: "Error updating Medical record", error: error.message });
        }
  }
  
}

module.exports = MedicalRecordsController;