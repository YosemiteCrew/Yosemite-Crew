/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Request, Response } from 'express';
import medicalRecords from '../models/medical-records-model';
// import { PetService } from '../services/PetService';
import FHIRMedicalRecordService from '../services/fHIRMedicalRecordService';
import  mongoose  from 'mongoose';
import helpers from '../utils/helpers';
import { AuthenticatedRequest, FHIRMedicalRecord, MedicalRecordRequestBody } from '@yosemite-crew/types';
import PetService from '../services/PetService';

const medicalRecordsController = {

  saveMedicalRecord: async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
     
    const { data }: MedicalRecordRequestBody = req.body;
        const { files }: MedicalRecordRequestBody = req.files;

    
    if (!data) {
      res.status(200).json({
        status: 0,
        message: "Missing data field",
        error: "FHIR data is required in 'data' field",
      });
      return;
    }

    let parsedData: FHIRMedicalRecord;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      parsedData = JSON.parse(data);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      res.status(200).json({
        status: 0,
        message: "Invalid JSON",
        error: "Unable to parse 'data' field as JSON",
      });
      return;
    }

     
    const medicalData = FHIRMedicalRecordService.convertFHIRToMedicalRecord(parsedData);

     
    if (!medicalData.documentType || !medicalData.title) {
      res.status(200).json({
        status: 0,
        message: "Validation failed",
        error: "Fields documentType and title are required.",
      });
      return;
    }

     
    if (!req.user?.username) {
      res.status(200).json({
        status: 0,
        message: "Unauthorized",
        error: "username not found in token",
      });
      return;
    }

    let issueDate: Date | null = null;
    let expiryDate: Date | null = null;
    let hasExpiryDate = false;

     
    if (medicalData.issueDate) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      issueDate = new Date(medicalData.issueDate);
      if (isNaN(issueDate.getTime())) {
        res.status(200).json({
          status: 0,
          message: "Invalid issueDate",
          error: "issueDate must be a valid date",
        });
        return;
      }
    }

     
    if (medicalData.expiryDate) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expiryDate = new Date(medicalData.expiryDate);
      hasExpiryDate = true;
      if (isNaN(expiryDate.getTime())) {
        res.status(200).json({
          status: 0,
          message: "Invalid expiryDate",
          error: "expiryDate must be a valid date",
        });
        return;
      }
    }

    if (issueDate && expiryDate && expiryDate < issueDate) {
      res.status(200).json({
        status: 0,
        message: "Date validation failed",
        error: "expiryDate cannot be earlier than issueDate",
      });
      return;
    }

     
       const [medicalDocs] = await Promise.all([
        req.files ? PetService.uploadFiles(req.files) : Promise.resolve([]),
      ]);
      console.log("medical",medicalDocs)
    const newMedicalRecord = await medicalRecords.create({
      userId: req.user.username,
      documentType: medicalData.documentType,
      title: medicalData.title,
      issueDate: medicalData.issueDate,
      expiryDate: medicalData.expiryDate,
      petId: medicalData.patientId,
      hasExpiryDate,
      medicalDocs,
    });

    const fhirResponse = FHIRMedicalRecordService.convertMedicalRecordToFHIR(newMedicalRecord);

    res.status(200).json({ status: 1, data: fhirResponse });
  } catch (error: any) {
    console.error("SaveMedicalRecord Error:", error);

    if (error.name === "ValidationError") {
      res.status(200).json({
        status: 0,
        message: "Mongoose validation failed",
        errors: error.errors,
      });
    } else {
      res.status(200).json({
        status: 0,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
  },

  medicalRecordList: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.username) {
        return res.status(401).json({
          status: 0,
          message: "Unauthorized",
          error: "Username not found in token",
        });
      }

      const userId = req.user.username;
      const records = await medicalRecords.find({ userId });

      if (!records || records.length === 0) {
        return res.status(404).json({
          status: 0,
          message: "No medical records found for this user",
        });
      }

      const fhirRecords = records.map(record =>
        FHIRMedicalRecordService.convertMedicalRecordToFHIR(record)
      );

      return res.status(200).json({
        status: 1,
        resourceType: "Bundle",
        type: "searchset",
        total: fhirRecords.length,
        entry: fhirRecords.map(resource => ({ resource })),
      });
    } catch (error: any) {
      console.error("medicalRecordList Error:", error);

      return res.status(500).json({
        status: 0,
        message: "Internal server error",
        error: error.message ?? "Unknown error",
      });
    }
  },

  deleteMedicalRecord: async (req: Request, res: Response): Promise<void> => {
    try {
      const recordId = req.query.recordId as string;

      if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
        res.status(400).json({
          status: 0,
          message: "Invalid or missing medical record ID",
        });
      }

      const result = await FHIRMedicalRecordService.deleteMedicalRecord(recordId);

      if (!result) {
        res.status(404).json({
          status: 0,
          message: "Medical record not found",
        });
      }

      if (result.deletedCount === 0) {
        res.status(400).json({
          status: 0,
          message: "Medical record could not be deleted",
        });
      }

      res.status(200).json({
        status: 1,
        message: "Medical record deleted successfully",
      });

    } catch (error: any) {
      console.error("deleteMedicalRecord Error:", error);

      res.status(500).json({
        status: 0,
        message: "Internal server error",
        error: error.message ?? "Unknown error",
      });
    }
  },

  editMedicalRecord: async (req: Request, res: Response): Promise<void> => {
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
        res.status(200).json({ status: 0, message: "Invalid FHIR JSON data" });
      }

      // FHIR to internal model conversion
      const medicalData = await FHIRMedicalRecordService.convertFHIRToMedicalRecord(parsedData);

      if (!medicalData.documentType || !medicalData.title) {
        res.status(200).json({
          status: 0,
          message: "Validation failed",
          error: "Fields documentType, title, issueDate, and expiryDate are required.",
        });
      }
      if (!req.user || !req.user.username) {
        res.status(200).json({
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
          res.status(200).json({
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
          res.status(200).json({
            status: 0,
            message: "Invalid expiryDate",
            error: "expiryDate must be a valid date",
          });
        }
      }

      // If both dates are present, check logical order
      if (issueDate && expiryDate && expiryDate < issueDate) {
        res.status(200).json({
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
        updatedMedicalRecords = await medicalRecords.findOneAndUpdate(
          { _id: id },
          {
            $set: updatedData,
            $push: { medicalDocs: medicalFileUrl }
          },
          { new: true }
        );
      } else {
        updatedMedicalRecords = await medicalRecords.findOneAndUpdate(
          { _id: id },
          { $set: updatedData },
          { new: true }
        );
      }

      if (!updatedMedicalRecords) {
        res.status(200).json({ status: 0, message: "Medical record not found" });
      }

      const fhirResponse = await FHIRMedicalRecordService.convertMedicalRecordToFHIR(updatedMedicalRecords);

      res.status(200).json({ status: 1, data: fhirResponse });
    } catch (error) {
      res.status(200).json({ status: 0, message: "Error updating Medical record", error: error.message });
    }
  }

}

export default medicalRecordsController;