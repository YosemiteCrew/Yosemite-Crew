import { Request, Response } from 'express';
import medicalRecords from '../models/medical-records-model';
import FHIRMedicalRecordService from '../services/fHIRMedicalRecordService';
import mongoose from 'mongoose';
import helpers from '../utils/helpers';
import { FHIRMedicalRecord, MedicalRecordRequestBody, FileUrl, MedicalRecordFolderRequest, medicalRecord } from '@yosemite-crew/types';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import PetService from '../services/PetService';
import { UploadedFile } from 'express-fileupload';
import MedicalRecordFolderModel from '../models/medical-record-folder-model';

const medicalRecordsController = {

  saveMedicalRecord: async (req: Request, res: Response): Promise<void> => {
    try {

      const { data } = req.body as MedicalRecordRequestBody;
      let fileArray: unknown[] = [];
      if (req.files) {
        if (Array.isArray(req.files)) {
          fileArray = req.files;
        } else if (typeof req.files === 'object') {
          // If multer is configured with fields, req.files is an object: { fieldname: File[] }
          // Try to get all files from all fields
          fileArray = Object.values(req.files).flat();
        }
      }

      // Now filter and upload
      const updatedPetData = fileArray.length > 0
        ? await helpers.uploadFiles(fileArray as unknown as UploadedFile[])
        : [];

      const profileImage: FileUrl[] = (updatedPetData as unknown[]).map((file) => {
        if (
          typeof file === 'object' &&
          file !== null &&
          typeof (file as { url?: unknown }).url === 'string' &&
          typeof (file as { originalname?: unknown }).originalname === 'string' &&
          typeof (file as { mimetype?: unknown }).mimetype === 'string'
        ) {
          return {
            url: (file as { url: string }).url,
            originalname: (file as { originalname: string }).originalname,
            mimetype: (file as { mimetype: string }).mimetype
          };
        }
        // Optionally handle invalid file objects
        return {
          url: '',
          originalname: '',
          mimetype: ''
        };
      });


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

        parsedData = JSON.parse(data);

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
    } catch (error: unknown) {
      let message = "Internal server error";

      console.error("SaveMedicalRecord Error:", error);

      if (error instanceof Error) {
        message = error.message;

        // Mongoose validation error (optional check)
        if ((error as any).name === "ValidationError") {
          res.status(200).json({
            status: 0,
            message: message,
            errors: (error as any).errors,
          });
          return
        }

        res.status(200).json({
          status: 0,
          message: message,
          error: error.stack, // optional: detailed trace for debugging
        });
        return
      } else {
        res.status(200).json({
          status: 0,
          message: message,
        });
        return
      }
    }
  },


  medicalRecordList: async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.username) {
        res.status(401).json({
          status: 0,
          message: "Unauthorized",
          error: "Username not found in token",
        });
        return
      }

      const userId = req.user.username;
      const records = await medicalRecords.find({ userId });

      if (!records || records.length === 0) {
        res.status(404).json({
          status: 0,
          message: "No medical records found for this user",
        });
        return
      }

      const fhirRecords = records.map(record =>
        FHIRMedicalRecordService.convertMedicalRecordToFHIR(record)
      );

      res.status(200).json({
        status: 1,
        resourceType: "Bundle",
        type: "searchset",
        total: fhirRecords.length,
        entry: fhirRecords.map(resource => ({ resource })),
      });
      return
    } catch (error: unknown) {
      console.error("medicalRecordList Error:", error);
      const message = error instanceof Error ? error.message:'Unknown error'
      res.status(500).json({
        status: 0,
        message: "Internal server error",
        error: message,
      });
      return
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
        return
      }

      if (result.deletedCount === 0) {
        res.status(400).json({
          status: 0,
          message: "Medical record could not be deleted",
        });
        return
      }

      res.status(200).json({
        status: 1,
        message: "Medical record deleted successfully",
      });

    } catch (error: unknown) {
      console.error("deleteMedicalRecord Error:", error);
      const message = error instanceof Error ? error.message:'Unknown error'
      res.status(500).json({
        status: 0,
        message: message,
        error: message,
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

      let parsedData: FHIRMedicalRecord;
      try {
        parsedData = JSON.parse(fhirData);
      } catch (e) {
        res.status(200).json({ status: 0, message: "Invalid FHIR JSON data" });
        return;
      }

      // FHIR to internal model conversion
      const medicalData = FHIRMedicalRecordService.convertFHIRToMedicalRecord(parsedData);

      if (!medicalData.documentType || !medicalData.title) {
        res.status(200).json({
          status: 0,
          message: "Validation failed",
          error: "Fields documentType, title, issueDate, and expiryDate are required.",
        });
        return
      }
      if (!req.user || !req.user.username) {
        res.status(200).json({
          status: 0,
          message: "Unauthorized",
          error: "username not found in token",
        });
        return
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
          return
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
          return
        }
      }

      // If both dates are present, check logical order
      if (issueDate && expiryDate && expiryDate < issueDate) {
        res.status(200).json({
          status: 0,
          message: "Date validation failed",
          error: "expiryDate cannot be earlier than issueDate",
        });
        return
      }
      let medicalFileUrl = null;
      let updatedMedicalRecords: medicalRecord;
      const uploadedFiles = req.files as { files: Express.Multer.File | Express.Multer.File[] } | undefined;
      if (uploadedFiles?.files) {
        const files = Array.isArray(uploadedFiles.files)
          ? uploadedFiles?.files
          : [uploadedFiles.files]

        const images = files.filter(file => file.mimetype?.startsWith('image/'));

        // Upload files if present
        if (images.length > 0) {
          const uploadedFilesForHelper = images.map(file => ({
            name: file.originalname,
            data: file.buffer,
            mimetype: file.mimetype,
            size: file.size,
          }));
          const uploaded = await helpers.uploadFiles(uploadedFilesForHelper);
          medicalFileUrl = uploaded.map(file => file.url)
        }
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
        return
      }

      const fhirResponse = FHIRMedicalRecordService.convertMedicalRecordToFHIR(updatedMedicalRecords);

      res.status(200).json({ status: 1, data: fhirResponse });
    } catch (error) {
      const message = error instanceof Error ? error.message:'Error updating Medical record'
      res.status(200).json({ status: 0, message: message });
    }
  },

  createMedicalRecordFolder: async(req: MedicalRecordFolderRequest, res: Response): Promise<void> => {
    try {

      const s3 = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
      });
      const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
      
      if (!BUCKET_NAME) {
        res.status(500).json({
          status: 0,
          message: "AWS bucket name is not configured",
        });
        return;
      }

      const { caseFolderName } = req.body;
      const files = req.files as Express.Multer.File[] | undefined;

      if (!caseFolderName) {
        res.status(400).json({
          status: 0,
          message: "Missing required fields: caseFolderName",
        });
        return;
      }

      //  Check for duplicate folder
     const existing = await MedicalRecordFolderModel.findOne({ folderName: caseFolderName.toLowerCase() });
     if (existing) {
      res.status(400).json({
        status: 0,
        message: "Folder with this name already exists",
      });
      return;
    }
      const folderKey = `medical-records/${caseFolderName}/`;
      // Upload an empty object to simulate folder creation in S3
     await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: folderKey,
        Body: "",
      })
    );

    const fileUploadPromises: Promise<unknown>[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const key = `${folderKey}-${file.originalname}`;
        const uploadCommand = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }); 
        fileUploadPromises.push(s3.send(uploadCommand));
      }
     
    };
     await Promise.all(fileUploadPromises);

      const newFolder = new MedicalRecordFolderModel({
        folderName: caseFolderName.toLowerCase(),
        folderUrl: folderKey,
      });

      await newFolder.save();

      res.status(200).json({
        status: 1,
        message: "Medical record folder created successfully",
        data: {
          folderName: newFolder.folderName,
          folderUrl: newFolder.folderUrl,
        },
      });
    } catch (error) {
      console.error("Error creating medical record folder:", error);
      res.status(500).json({
        status: 0,
        message: "Internal server error",
      });
      return
    }
  },
}

export default medicalRecordsController;