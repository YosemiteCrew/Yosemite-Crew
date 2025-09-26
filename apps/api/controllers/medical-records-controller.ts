import  { Request, Response } from 'express';
import logger from '../utils/logger';
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


      if (!medicalData.title) {
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
      let id: mongoose.Types.ObjectId = medicalData.documentTypeId; 
      id = medicalData.documentTypeId 
      
      const isRead= id ? true : medicalData.createdByRole === 'petOwner' ? true : false
      const newMedicalRecord = await medicalRecords.create({
        userId: req.user.username,
        documentTypeId: id,
        title: medicalData.title,
        issueDate: medicalData.issueDate,
        expiryDate: medicalData.expiryDate,
        petId: medicalData.patientId,
        hasExpiryDate,
        isRead: isRead,
        medicalDocs: updatedPetData,
        createdByRole:medicalData.createdByRole
      });
      
      const populatedMedicalRecord = await newMedicalRecord.populate({
        path: 'documentTypeId',  // The field to populate
        select: 'folderName',  // Only select the 'name' field
      });
      const formattedData = {
        ...populatedMedicalRecord,
        documentType: populatedMedicalRecord.documentTypeId?.folderName,
        documentTypeId: populatedMedicalRecord.documentTypeId?._id
      }

      const fhirResponse = FHIRMedicalRecordService.convertMedicalRecordToFHIR(formattedData._doc);

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
      const records :medicalRecord[] = await medicalRecords.aggregate([
        {
          $match: {
             userId:userId, 
             isRead: true ,
              $or: [
                   { documentTypeId: { $exists: false } },  // field not present
                   { documentTypeId: null }                 // field exists but null
      ] 
          }
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
      logger.error("medicalRecordList Error:", error);
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
      logger.error("getMedicalUnreadRecords Error:", error);
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
      logger.error("deleteMedicalRecord Error:", error);
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
        logger.error(error);
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
        documentTypeId: medicalData.documentTypeId,
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

      const { caseFolderName , petId, medicalRecords} = req.body as {caseFolderName:string, petId?:string, medicalRecords?:[]}
      const parsedMedicalRecords = medicalRecords ?  medicalRecords.map((id: string) => new mongoose.Types.ObjectId(id) ):[];
      const files = req.files?.files as Express.Multer.File[] | undefined;

      if (!caseFolderName) {
        res.status(200).json({
          status: 0,
          message: "Missing required fields: caseFolderName",
        });
        return;
      }
      const safeCaseFolderName = String(caseFolderName || "").toLowerCase().trim();
      const safePetId = petId ? new mongoose.Types.ObjectId(petId) : null;

      const query :{folderName:string, petId: mongoose.Types.ObjectId | null | object} = {
        folderName: safeCaseFolderName,
        petId:null
      };

      if (safePetId) {
         query.petId = safePetId;
      } else {
        query.petId = { $exists: false };
      }
 
     const existing = await MedicalRecordFolderModel.findOne(query);
      if (existing) {
        res.status(200).json({
          status: 0,
          message: "Folder with this name already exists",
        });
        return;
      }
      const sanitizedFolderName = caseFolderName.replace(/\s+/g, ''); 
      const folderKey = `medical-records/${sanitizedFolderName}/`;
      // Upload an empty object to simulate folder creation in S3
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: folderKey,
          Body: "",
        })
      );

      const fileUploadPromises: Promise<unknown>[] = [];
      const uploadedFiles: {url:string, originalName:string, mimetype:string}[]=[];
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
          uploadedFiles.push({
            url:key,
            originalName:file.originalname,
            mimetype:file.mimetype
          })
        }

      };
      await Promise.all(fileUploadPromises);
     // console.log(medicalRecords);
      const newFolder = new MedicalRecordFolderModel({
        folderName: caseFolderName.toLowerCase(),
        folderUrl: folderKey,
        petId:petId,
        medicalRecords:parsedMedicalRecords
      });

    const savded =   await newFolder.save();
    

      res.status(200).json({
        status: 1,
        message: "Medical record folder created successfully",
        data: {
          folderName: newFolder.folderName,
          folderUrl: newFolder.folderUrl,
        },
      });
    } catch (error) {
      logger.error("Error creating medical record folder:", error);
      res.status(200).json({
        status: 0,
        message: "Internal server error",
      });
      return
    }
  },
  getMedicalRecordFolderList: async (req: Request, res: Response): Promise<void> => {
    try {
      const { petId } = req.query as { petId?: string }
      
      const list = await MedicalRecordFolderModel.aggregate([
        {
          $match: {
            $or: [
              { petId: new mongoose.Types.ObjectId(petId) },
              { petId: null },
            ]
          }
        },
        {
    $lookup: {
      from: "medicalrecords",            // collection name
      localField: "medicalRecords",      // array of ObjectIds
      foreignField: "_id",               // match MedicalRecords by _id
      as: "files"
    }
  },
        // {
        //   $lookup: {
        //     from: 'medicalrecords',
        //     localField: '_id',
        //     foreignField: 'documentTypeId',
        //     as: 'files'
        //   }
        // },
        {
          $addFields: {
            fileCount: { $size: "$files" }
          }
        },
        {
          $project: {
            _id: 1,
            folderName: 1,
            folderUrl: 1,
            createdAt: 1,
            updatedAt: 1,
            fileCount: 1,
            petId: 1
          }
        }
      ])

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
  },
  getMedicalRecordByFolderId: async(req:Request, res:Response):Promise<void>=>{
    try {
      const userId= getCognitoUserId(req);
      if (!userId) {
        res.status(200).json({
          status: 0,
          message: "Unauthorized",
          error: "User ID not found in token",
        });
        return;
      }
      
      
      // Validate folderId
      if (!req.query.folderId) {
        res.status(200).json({
          status: 0,
          message: "Missing folder ID",
        });
        return;
      }
      const folderId = req.query.folderId as string;
      if (!folderId || !mongoose.Types.ObjectId.isValid(folderId)) {
        res.status(200).json({
          status: 0,
          message: "Invalid or missing folder ID",
        });
        return;
      }

      const records = await MedicalRecordFolderModel.findById(folderId).populate('medicalRecords')
      const fhirRecords = records?.medicalRecords.length ? records?.medicalRecords.map(record =>
        FHIRMedicalRecordService.convertMedicalRecordToFHIR(record)
      ) :[];
      res.status(200).json({
        status: 1,
        resourceType: "Bundle",
        type: "searchset",
        total: records?.medicalRecords.length,
        entry: fhirRecords.map(resource => ({ resource })),
      });
      return;
    }
    catch (error: unknown) {
      logger.error("getMedicalRecordByFolderId Error:", error);
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(200).json({
        status: 0,
        message: "Internal server error",
        error: message,
      });
      return;
    }
  },
  placeFileInFolder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { folderId, recordIds } = req.body as { folderId: string, recordIds: [] }
      if (!folderId || !recordIds) {
        res.status(200).json({
          status: 0,
          message: "Missing required fields: folderId or recordIds",
        });
        return;
      }
      if (!mongoose.Types.ObjectId.isValid(folderId)) {
        res.status(200).json({
          status: 0,
          message: "Invalid folderId format",
        });
        return;
      }
      await MedicalRecordFolderModel.findByIdAndUpdate(folderId, {
        $push: { medicalRecords: { $each: recordIds } },
      });
      res.status(200).json({ message: '', status: 1 })
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : ' An Internal server error occurred'
      res.status(200).json({ status: 0, message: message })
    }
  },
  searchMedicalRecordByName: async (req: Request, res: Response): Promise<void> => {
    try {
      const name = req.query.name as string;
      
      if (!name) {
        res.status(200).json({ status: 0, message: "Name is required" });
        return;
      }
      const records = await medicalRecords.find({
        title: { $regex: name, $options: "i" }  // "i" => case-insensitive
      }).lean();
      if (!records.length) {
        res.status(200).json({ status: 0, message: "No records found" });
        return;
      }
      res.status(200).json({
        status: 1,
        data: {entry:records},
        message: "All records fetched successfully!"
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred.'
      res.status(200).json({ status: 0, message: message })
    }
  }
  
}

export default medicalRecordsController;