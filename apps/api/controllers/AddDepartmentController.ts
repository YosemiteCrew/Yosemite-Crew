import { Request, Response } from 'express';
import { DepartmentFromFHIRConverter } from '../utils/DepartmentFhirHandler';
import { DepartmentCustomFormat } from '../../../packages/types/src/Departments/DepartmentTypes';
import Department from '../models/AddDepartment';
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
  addDepartment: async (req: Request, res: Response): Promise<void> => {
    const data: DepartmentCustomFormat = new DepartmentFromFHIRConverter(req.body).toCustomFormat();

    try {
      const newDepartment = new Department({
        departmentName: data.departmentName,
        bussinessId: data.bussinessId,
        description: data.description,
        email: data.email,
        phone: data.phone,
        countrycode: data.countrycode,
        services: data.services,
        departmentHeadId: data.departmentHeadId,
        consultationModes: data.consultationModes,
        conditionsTreated: data.conditionsTreated,
      });

      const response = await newDepartment.save();

      if (response) {
        res.status(201).json(newDepartment);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating department:', message);
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
        '_id departmentName'
      );

      if (!departments || departments.length === 0) {
        res.status(404).json({ message: 'No departments found' });
      } else {
        res.status(200).json(departments);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message });
    }
  },

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
