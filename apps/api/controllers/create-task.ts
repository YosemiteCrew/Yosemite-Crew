import dotenv from "dotenv";
dotenv.config();
import { Request, Response } from "express";
import { convertTaskFromFHIR, convertToFHIRDoctorOptions } from "@yosemite-crew/fhir";
import { S3 } from "aws-sdk";
import createTask from "../models/create-task";
import { WebUser } from "../models/WebUser";
import mongoose from "mongoose";
import AddDoctors from "../models/AddDoctor";

// Configure AWS S3
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Upload file to S3 and return S3 key
type UploadedFile = {
  data: Buffer;
  name: string;
  mimetype: string;
  size: number;
};

const uploadToS3 = (file: unknown, folderName: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const f = file as UploadedFile;
    if (!f.data) return reject(new Error(`No data for file: ${f.name}`));

    const key = `${folderName}/${Date.now()}_${f.name}`;

    s3.upload(
      {
        Bucket: process.env.AWS_S3_BUCKET_NAME || "your-bucket-name",
        Key: key,
        Body: (file as UploadedFile).data,
        ContentType: (file as UploadedFile).mimetype,
      },
      (err) => {
        if (err) return reject(err);
        resolve(key); // return only the S3 key
      }
    );
  });
};

const createTaskController = {
  createTask: async (req: Request, res: Response): Promise<void> => {
    try {
      // Parse FHIR task
      let fhirTask: unknown;
      if (
        req.body &&
        typeof req.body === "object" &&
        "fhirTask" in req.body &&
        typeof (req.body as { fhirTask?: unknown }).fhirTask === "string"
      ) {
        fhirTask = JSON.parse((req.body as { fhirTask: string }).fhirTask);
      } else {
        throw new Error("Invalid or missing fhirTask in request body");
      }
      const { formData } = convertTaskFromFHIR(fhirTask);

      console.log("files", formData);

      // Uploaded files array (with metadata)
      const uploadedFiles: { key: string; name: string; type: string; date: Date }[] = [];

      const filesObj = req.files as { files?: UploadedFile | UploadedFile[] };
      if (filesObj && filesObj.files) {
        const fileArray = Array.isArray(filesObj.files)
          ? filesObj.files
          : [filesObj.files];

        for (const file of fileArray) {
          if (file.size > 0 && file.data) {
            const key = await uploadToS3(file, "taskFiles");
            uploadedFiles.push({
              name: key,
              type: file.mimetype,
              date: new Date(),
              key: ""
            });
          }
        }
      }

      // Save task in MongoDB
      const newTask = new createTask({
        ...formData,
        uploadedFiles, // contains key + metadata
      });

      const savedTask = await newTask.save();

      res.status(201).json({ message: "Task created successfully", data: savedTask });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error creating task:", {
        message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ message: "Server error", error: message });
    }
  },

  getDoctorsByDepartmentIdToCreateTask: async (req: Request, res: Response) => {
  try {
    const { userId, departmentId } = req.query as { userId: string, departmentId: string };

    if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
      res.status(400).json({ message: "Invalid doctorId format" });
      return;
    }

    if (typeof departmentId !== 'string' || !mongoose.Types.ObjectId.isValid(departmentId)) {
      res.status(400).json({ message: 'Invalid or missing departmentId format' });
      return;
    }

    // Step 1: Get business ID from WebUser
    const user = await WebUser.findOne({ cognitoId: userId }).select("bussinessId -_id");
    if (!user || !user.bussinessId) {
      res.status(404).json({ message: "Business ID not found for user." });
      return;
    }

    // Step 2: Find all vets, vetTechnicians, nurses, vetAssistants under the same business
    const allowedRoles = ["vet", "vetTechnician", "nurse", "vetAssistant"];
    const vetUsers = await WebUser.find({
      bussinessId: user.bussinessId,
      department: departmentId,
      role: { $in: allowedRoles },
    }).select("cognitoId role -_id");

    const vetIds = vetUsers.map((v) => v.cognitoId);
    if (vetIds.length === 0) {
      res.status(200).json({ message: "No eligible staff found.", data: [] });
      return;
    }

    // Step 3: Find doctor profile data
    const allDoctors = await AddDoctors.find({ userId: { $in: vetIds }, status: "On-Duty" })
      .select("firstName lastName userId role -_id");

    // Step 4: Format response as { label, value }
    const formattedDoctors = allDoctors.map((doc) => ({
      label: `${doc.firstName} ${doc.lastName}`,
      value: doc.userId,
    }));

    res.status(200).json({
      message: "Fetched doctors successfully",
      data: convertToFHIRDoctorOptions(formattedDoctors),
    });
  } catch (error) {
    console.error("Error fetching doctors by department ID:", error);
    res.status(500).json({
      message: "Internal server error",
      error: (error as Error).message,
    });
  }
},

// searchAppointments: async (req: Request, res: Response):Promise<void> => {
//   try {
//     const { petName, patientName} = req.query as { petName?: string; patientName?: string };
//     let filter: any = {
//       ...(petName ? { petName: { $regex: petName, $options: 'i' } } : {}),
//       ...(patientName ? { patientName: { $regex: patientName, $options: 'i' } } : {}),
//     };

//   } catch (error) {
    
//   }
// }

};

export default createTaskController;
