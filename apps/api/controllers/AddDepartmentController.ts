import { Request, Response } from 'express';
// import { DepartmentFromFHIRConverter } from '../utils/DepartmentFhirHandler';
import { DepartmentCustomFormat, FHIRDepartment, FHIRHealthcareService } from '@yosemite-crew/types';
import Department from '../models/AddDepartment';
import { convertAdminDepartmentsToFHIR, convertDepartmentFromFHIR, convertDepartmentsToFHIR, convertToFHIRDepartment } from '@yosemite-crew/fhir';
import { ProfileData } from '../models/WebUser';
import adminDepartments from '../models/admin-department';
import mongoose from 'mongoose';
// import AWS from 'aws-sdk';
// import { UploadedFile } from 'express-fileupload';
// console.log(process.env,process.env.AWS_ACCESS_KEY_ID,process.env.AWS_SECRET_ACCESS_KEY,process.env.AWS_REGION);
// Validate AWS credentials
// const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = process.env;
// if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
//   throw new Error('Missing AWS environment variables');
// }

// Initialize S3
// const s3 = new AWS.S3({
//   accessKeyId: AWS_ACCESS_KEY_ID,
//   secretAccessKey: AWS_SECRET_ACCESS_KEY,
//   region: AWS_REGION,
// });

const AddDepartmentController = {
  getDepartmets:async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;
    console.log("hello")

    if (!userId) {
      res.status(400).json({ message: "Missing userId" });
      return;
    }
 if (typeof userId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        res.status(400).json({ message: 'Invalid doctorId format' });
        return;
      }
    // Step 1: Get profile
    const profile = await ProfileData.findOne({ userId });

    if (!profile || !profile.addDepartment || profile.addDepartment.length === 0) {
      res.status(404).json({ message: "No departments found in profile" });
      return;
    }

    // Step 2: Fetch departments by IDs from adminDepartments
    const departments = await adminDepartments.find({
      _id: { $in: profile.addDepartment },
    });

    res.status(200).json({
      success: true,
      data: convertAdminDepartmentsToFHIR(departments),
    });

  } catch (error) {
    const err = error as Error
    console.error("Error fetching departments:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
},
  addDepartment: async (req: Request, res: Response): Promise<void> => {
    const data: DepartmentCustomFormat = convertDepartmentFromFHIR(req.body as FHIRDepartment) ;
  
    try {
      // ✅ Check if department name and business ID already exist
      const updatedDepartment = await Department.findOneAndUpdate(
        { 
          departmentId: { $regex: `^${data.departmentId.trim()}$`, $options: 'i' },
          bussinessId: data.bussinessId
        },
        {
          departmentId: data.departmentId.trim(),
          bussinessId: data.bussinessId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          biography: data.biography,
          email: data.email,
          phone: data.phone,
          countrycode: data.countrycode,
          services: data.services,
          departmentHeadId: data.departmentHeadId,
        },
        { 
          new: true, // Return the updated document
          upsert: true, // Create if it doesn't exist
          setDefaultsOnInsert: true // Apply schema defaults on insert
        }
      );

      if (updatedDepartment) {
        res.status(201).json(updatedDepartment);
      } else {
        throw new Error('Failed to create or update department');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating or updating department:', message);
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: message,
          },
        ],
      });
    }
  },

  getAddDepartment: async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.query;

      if (typeof userId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        res.status(400).json({ message: 'Invalid doctorId format' });
        return;
      }

      const departments = await Department.find({ bussinessId: userId }).select(
        '_id'
      );

      if (!departments || departments.length === 0) {
        res.status(404).json({ message: 'No departments found' });
      } else {
         
        const response:FHIRHealthcareService[] = convertDepartmentsToFHIR(departments as [] )
        res.status(200).json(response);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message });
    }
  },
getDepartmentById: async (req: Request, res: Response): Promise<void> => {
  try {
    const { Id } = req.query;

    // Validate Id exists and is a valid string
    if (typeof Id !== 'string' || !mongoose.Types.ObjectId.isValid(Id)) {
      res.status(400).json({ message: 'Invalid or missing departmentId format' });
      return;
    }

    // Always use parameterized queries — you're doing this correctly here
    const response = await Department.findOne({ departmentId: Id });

    if (response) {
      const data = convertToFHIRDepartment({
        departmentId: response.departmentId,
        biography: response.biography,
        email: response.email,
        phone: response.phone,
        countrycode: response.countrycode,
        services: response.services,
        departmentHeadId: response.departmentHeadId,
        bussinessId: response.bussinessId,
      });
      res.status(200).json(data);
    } else {
      res.status(404).json({ message: "No Department Data Exist" });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
}
  // uploadimage: async (req: Request, res: Response): Promise<void> => {
  //   try {
  //     if (!req.files || !('image' in req.files)) {
  //       res.status(400).json({ message: 'No image file provided' });
  //       return;
  //     }

  //     const image = req.files.image as UploadedFile;

  //     const uploadToS3 = (file: UploadedFile, folderName: string): Promise<string> => {
  //       return new Promise((resolve, reject) => {
  //         const params: AWS.S3.PutObjectRequest = {
  //           Bucket: 'yosemitecrew-website',
  //           Key: `${folderName}/${Date.now()}_${file.name}`,
  //           Body: file.data,
  //           ContentType: file.mimetype,
  //         };

  //         s3.upload(params, (err, data) => {
  //           if (err) {
  //             console.error('Error uploading to S3:', err);
  //             reject(err);
  //           } else {
  //             resolve(data.Key);
  //           }
  //         });
  //       });
  //     };

  //     const key = await uploadToS3(image, 'images');
  //     res.status(200).json({ key });
  //   } catch (error) {
  //     const message = error instanceof Error ? error.message : 'Unknown error';
  //     console.log('error', message);
  //     res.status(500).json({ message: 'Image upload failed' });
  //   }
  // },
};

export default AddDepartmentController;
