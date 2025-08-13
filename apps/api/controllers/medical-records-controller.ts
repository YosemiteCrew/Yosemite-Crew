import { Request, Response } from 'express';
import medicalRecords from '../models/medical-records-model';
import FHIRMedicalRecordService from '../services/fHIRMedicalRecordService';
import mongoose from 'mongoose';
import helpers from '../utils/helpers';
import { MedicalRecordRequestBody, MedicalRecordFolderRequest, medicalRecord, FhirDocumentReference } from '@yosemite-crew/types';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { UploadedFile } from 'express-fileupload';
import MedicalRecordFolderModel from '../models/medical-record-folder-model';
import { getCognitoUserId } from '../middlewares/authMiddleware';


interface AuthenticatedUser {
  id: string;
  username: string;
}
const medicalRecordsController = {

  saveMedicalRecord: async (req: Request & { user?: AuthenticatedUser }, res: Response): Promise<void> => {
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

      (updatedPetData as unknown[]).map((file) => {
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


      let parsedData: FhirDocumentReference;
      try {

        parsedData = JSON.parse(data) as FhirDocumentReference;
      
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        res.status(200).json({
          status: 0,
          message: message,
          error: "Unable to parse 'data' field as JSON",
        });
        return;
      }


      const medicalData = FHIRMedicalRecordService.convertFhirToMedicalRecord(parsedData);


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

      const newMedicalRecord = await medicalRecords.create({
        userId: req.user.username,
        documentType: medicalData.documentType,
        title: medicalData.title,
        issueDate: medicalData.issueDate,
        expiryDate: medicalData.expiryDate,
        petId: medicalData.patientId,
        hasExpiryDate,
        medicalDocs: updatedPetData
      });

      const fhirResponse = FHIRMedicalRecordService.convertMedicalRecordToFHIR(newMedicalRecord);

      res.status(200).json({ status: 1, data: fhirResponse , message:'New record created successfully!'});
    } catch (error: unknown) {
      let message = "Internal server error";

      if (error instanceof Error) {
        message = error.message;
        if ((error instanceof mongoose.Error.ValidationError)) {
          res.status(200).json({
            status: 0,
            message: message,
            errors: error.errors,
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
  medicalRecordList: async (req: Request & { user?: AuthenticatedUser }, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.username) {
        res.status(200).json({
          status: 0,
          message: "Unauthorized",
          error: "Username not found in token",
        });
        return
      }

      const userId = req.user.username;
      const records = await medicalRecords.aggregate([
        {
          $match: { userId, isRead: true }
        },
        {
          $lookup: {
            from: "pets", // collection name in MongoDB
            localField: "petId",
            foreignField: "_id",
            as: "petData"
          }
        },
        {
          $project: {
           _id: 1,
            userId: 1,
            documentType: 1,
            title: 1,
            issueDate: 1,
            hasExpiryDate: 1,
            expiryDate: 1,
            medicalDocs: 1,
            isRead: 1,
            createdAt: 1,
            updatedAt: 1,
            petImage: { $arrayElemAt: ["$petData.petImage", 0] },
             petId: { $arrayElemAt: ["$petData._id", 0] },
          }
        }
      ]);

      if (!records || records.length === 0) {
        res.status(200).json({
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
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(200).json({
        status: 0,
        message: "Internal server error",
        error: message,
      });
      return
    }
  },
  getMedicalUnreadRecords: async (req:Request, res:Response): Promise<void> =>{
    try {
       const userId = getCognitoUserId(req);
     
      
      if (!userId ) {
        res.status(200).json({
          status: 0,
          message: "Invalid or missing user ID",
        });
        return;
      }
  
      const unreadRecords = await medicalRecords.aggregate([
        {
          $match: { userId: userId, isRead: false }
        },
        {
          $lookup: {
            from: "pets", // collection name in MongoDB
            localField: "petId",
            foreignField: "_id",
            as: "petData"
          }
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            documentType: 1,
            title: 1,
            issueDate: 1,
            hasExpiryDate: 1,
            expiryDate: 1,
            medicalDocs: 1,
            isRead: 1,
            createdAt: 1,
            updatedAt: 1,
            petImage: { $arrayElemAt: ["$petData.petImage", 0] },
             petId: { $arrayElemAt: ["$petData._id", 0] },
          }
        }
      ]);
      
      if (!unreadRecords || unreadRecords.length === 0) {
        res.status(200).json({
          status: 0,
          message: "No unread medical records found for this user",
        });
        return;
      }
      
      const fhirRecords = unreadRecords.map(record =>
        FHIRMedicalRecordService.convertMedicalRecordToFHIR(record)
      );
      res.status(200).json({
        status: 1,
        resourceType: "Bundle",
        type: "searchset",
        total: fhirRecords.length,
        entry: fhirRecords.map(resource => ({ resource })),
      });
    } catch (error: unknown) {
      console.error("getMedicalUnreadRecords Error:", error);
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(200).json({
        status: 0,
        message: "Internal server error",
        error: message,
      });
    }
  },
  getSpecificMedicalRecordById: async (req: Request, res: Response): Promise<void> =>{
    try {
      const recordId = req.query.recordId as string;
      if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
        res.status(200).json({
          status: 0,
          message: "Invalid or missing medical record ID",
        });
        return;
      }
      
      const record = await medicalRecords.findById(recordId).populate('petId', 'petImage');
      if (!record) {
        res.status(200).json({
          status: 0,
          message: "Medical record not found",
        });
        return;
      }
      record.isRead = true; // Mark as read
      await record?.save();

      const fhirRecord = FHIRMedicalRecordService.convertMedicalRecordToFHIR(record);
      res.status(200).json({
        status: 1,
        resourceType: "DocumentReference",
        data:fhirRecord,
      });
      return;
      

    }catch(error:unknown){
      const message = error instanceof Error ? error.message : 'Error fetching specific medical record';
      res.status(200).json({
        status: 0,
        message: message,
      });
      return;
    }
  },
  deleteMedicalRecord: async (req: Request, res: Response): Promise<void> => {
    try {
      const recordId = req.query.recordId as string;

      if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
        res.status(200).json({
          status: 0,
          message: "Invalid or missing medical record ID",
        });
      }

      const result = await FHIRMedicalRecordService.deleteMedicalRecord(recordId);

      if (!result) {
        res.status(200).json({
          status: 0,
          message: "Medical record not found",
        });
        return
      }

      if (result.deletedCount === 0) {
        res.status(200).json({
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
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(200).json({
        status: 0,
        message: message,
        error: message,
      });
    }
  },
  editMedicalRecord: async (req: Request & { user?: AuthenticatedUser }, res: Response): Promise<void> => {
    try {
      const { data } = req.body as { data: string };
      const id = req.query.recordId;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid ID format");
      }

      let parsedData: FhirDocumentReference
      try {
        parsedData = JSON.parse(data);
      } catch (error: unknown) {
        console.log(error);
        res.status(200).json({ status: 0, message: "Invalid FHIR JSON data" });
        return;
      }

      // FHIR to internal model conversion
      const medicalData = FHIRMedicalRecordService.convertFhirToMedicalRecord(parsedData);

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
      let updatedMedicalRecords: medicalRecord | null;
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
      const message = error instanceof Error ? error.message : 'Error updating Medical record'
      res.status(200).json({ status: 0, message: message });
    }
  },
  getFilesOfAllMedicalRecords: async (req: Request, res: Response): Promise<void> => {
    try{
      const userId =  getCognitoUserId(req)
      if (!userId) {
        res.status(200).json({
          status: 0,
          message: "Unauthorized",
          error: "User ID not found in token",
        });
        return;
      }

      const medicalRecordList = await medicalRecords.find({userId: userId}).select('medicalDocs').lean();
      if (!medicalRecordList || medicalRecordList.length === 0) {
        res.status(200).json({
          status: 0,
          message: "No medical records found for this user",
        });
        return;
      }

      const allFiles = medicalRecordList.flatMap(record => record.medicalDocs || []);
      res.status(200).json({
        status: 1,
        data: allFiles,
      });
      return;

    }catch(error:unknown){
      const message = error instanceof Error ? error.message : 'Error fetching medical record files';
      res.status(200).json({
        status: 0,
        message: message,
      });
      return;
    }
  },
  deleteSpecificImageFromMedicalRecord: async (req: Request, res: Response): Promise<void> => {
    try {
      const { recordId, imageUrl } = req.body as { recordId: string; imageUrl: string };

    if (!mongoose.Types.ObjectId.isValid(recordId)) {
      res.status(200).json({ status: 0, message: "Invalid recordId format" });
      return;
    }

    if (!recordId || !imageUrl) {
      res.status(200).json({ status: 0, message: "Missing recordId or imageUrl" });
      return;
    }
    const updatedRecord = await medicalRecords.findOneAndUpdate(
      { _id: recordId },
      { $pull: { medicalDocs: { url: imageUrl } } },
      { new: true }
    );
    if (!updatedRecord) {
      res.status(200).json({ status: 0, message: "Medical record not found" });
      return;
    }
    res.status(200).json({
      status: 1,
      message: "Image deleted successfully from medical record",
      data: updatedRecord,
    });
    }catch(error:unknown){
      const message = error instanceof Error ? error.message : 'Error deleting specific image from medical record';
      res.status(200).json({
        status: 0,
        message: message,
      });
      return;
    }
  },
  saveMedicalRecordFolder: async (req: MedicalRecordFolderRequest, res: Response): Promise<void> => {
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
        res.status(200).json({
          status: 0,
          message: "AWS bucket name is not configured",
        });
        return;
      }

      const { caseFolderName } = req.body;
      const files = req.files as Express.Multer.File[] | undefined;

      if (!caseFolderName) {
        res.status(200).json({
          status: 0,
          message: "Missing required fields: caseFolderName",
        });
        return;
      }

      //  Check for duplicate folder
      const existing = await MedicalRecordFolderModel.findOne({ folderName: caseFolderName.toLowerCase() });
      if (existing) {
        res.status(200).json({
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
      res.status(200).json({
        status: 0,
        message: "Internal server error",
      });
      return
    }
  },
  getMedicalRecordFolderList: async (req: Request, res: Response): Promise<void> => {
    try {

      const list = await MedicalRecordFolderModel.find({})
      res.status(200).json({
        status: 1,
        data: list,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error fetching medical record folders';
      res.status(200).json({
        status: 0,
        message: message,
      });
      return;
    }
  },
  deleteMedicalRecordFolder: async (req: Request, res: Response): Promise<void> =>{
    try {
      
      const folderid = req.query.folderId as string;
      if (!folderid || !mongoose.Types.ObjectId.isValid(folderid)) {
        res.status(200).json({
          status: 0,
          message: "Invalid or missing folder ID",
        });
        return;
      }

      const folder = await MedicalRecordFolderModel.findById(folderid);
      if (!folder) {
        res.status(200).json({
          status: 0,
          message: "Medical record folder not found",
        });
        return;
      }
      
      // Delete the folder from S3
      const s3 =  helpers.getS3Instance()
      const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
      if (!BUCKET_NAME) {
        res.status(200).json({
          status: 0,
          message: "AWS bucket name is not configured",
        });
        return;
      }

      // Delete all objects in the folder
      // List all objects under the folder
       const listParams = {
          Bucket: BUCKET_NAME,
           Prefix: folder.folderUrl as string // This should end with `/` if it's a folder path
        };

    const listedObjects = await s3.listObjectsV2(listParams).promise();

      if (listedObjects.Contents && listedObjects.Contents.length > 0) {
      const deleteParams = {
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: listedObjects.Contents.map(obj => ({ Key: obj.Key! }))
        }
      };
      await s3.deleteObjects(deleteParams).promise();
    }

      // Delete the folder document from MongoDB
      await MedicalRecordFolderModel.deleteOne({ _id: folderid });

      res.status(200).json({
        status: 1,
        message: "Medical record folder deleted successfully",
      });
      return;
    }catch( error :unknown){
      const message = error instanceof Error ? error.message : 'Error deleting medical record folder';
      res.status(200).json({
        status: 0,
        message: message,
      });
      return; 
    }
  }
  
}

export default medicalRecordsController;