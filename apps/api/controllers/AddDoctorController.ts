import Department from "../models/AddDepartment";
import AddDoctors from "../models/AddDoctor";
import crypto from "crypto";

import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminConfirmSignUpCommand,
  SignUpCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import FHIRConverter from "../utils/DoctorsHandler";
import { validateFHIR } from "../Fhirvalidator/FhirValidator";
// import { equal } from 'assert';
import AWS, { S3 } from "aws-sdk";
const SES = new AWS.SES();
import { WebUser } from "../models/WebUser";
import DoctorsTimeSlotes from "../models/doctors.slotes.model";
import { webAppointments } from "../models/WebAppointment";
import { Request, Response } from "express";
import { parseFhirBundle, File, Files, Document } from "@yosemite-crew/fhir";
import type {ParsedData} from "@yosemite-crew/fhir";
const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

function getSecretHash(email: string): string {
  const clientId = process.env.COGNITO_CLIENT_ID_WEB as string;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET_WEB as string;

  return crypto
    .createHmac("SHA256", clientSecret)
    .update(email + clientId)
    .digest("base64");
}

const confirmUser = async (userPoolId: string, QU: string): Promise<void> => {
  try {
    await cognito.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: userPoolId,
        Username: QU,
      })
    );
    // console.log('User successfully confirmed.');
  } catch (error) {
    console.error("Error confirming user:", error);
    throw error;
  }
};
function convertTo12HourFormat(dateObj: Date): string {
  let hours: number = dateObj.getHours();
  const minutes: string = dateObj.getMinutes().toString().padStart(2, "0");
  const period: string = hours >= 12 ? "PM" : "AM";

  hours = hours % 12 || 12; // Convert 0 to 12 for AM
  return `${hours}:${minutes} ${period}`;
}
const AddDoctorsController = {

  addDoctor: async (req: Request, res: Response): Promise<void> => {
    try {
      const formData = req.body.fhirBundle ? JSON.parse(req.body.fhirBundle): {};

      if (!formData.entry || !Array.isArray(formData.entry)) {
        res.status(400).json({
          error: "Invalid FHIR Bundle format. No 'entry' array found.",
        });
        return;
      }

      const parsedData = parseFhirBundle(formData);

      const {
        personalInfo,
        residentialAddress,
        professionalBackground,
        availability,
        consultFee,
        loginCredentials,
        authSettings,
        timeDuration,
        bussinessId,
        activeModes,
      } = parsedData as ParsedData;

      if (!loginCredentials?.username || !loginCredentials?.password) {
        res.status(400).json({ message: "Email and password are required." });
        return;
      }

      const userPoolId = process.env.COGNITO_USER_POOL_ID_WEB as string;
      const clientId = process.env.COGNITO_CLIENT_ID_WEB as string;
      const username = loginCredentials.username;

      let userExists = false;
      try {
        await cognito.send(
          new AdminGetUserCommand({
            UserPoolId: userPoolId,
            Username: username,
          })
        );
        userExists = true;
      } catch (error: any) {
        if (error.name !== "UserNotFoundException") {
          res.status(500).json({ message: "Error checking user existence." });
          return;
        }
      }

      if (userExists) {
        res.status(409).json({ message: "User already exists. Please login." });
        return;
      }

      const signUpParams: any = {
        ClientId: clientId,
        Username: username,
        Password: loginCredentials.password,
        UserAttributes: [{ Name: "email", Value: username }],
      };

      if (process.env.COGNITO_CLIENT_SECRET_WEB) {
        signUpParams.SecretHash = getSecretHash(username);
      }

      let data;
      try {
        data = await cognito.send(new SignUpCommand(signUpParams));
      } catch (err: any) {
        res.status(500).json({ message: "Error registering user. Please try again later." });
        return;
      }

      try {
        await cognito.send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: userPoolId,
            Username: username,
            UserAttributes: [{ Name: "email_verified", Value: "true" }],
          })
        );
        console.log("Email verified successfully.");
      } catch (error: any) {
        console.error("Error verifying email:", error);
      }

      await confirmUser(userPoolId, username);

      const login = await WebUser.create({
        cognitoId: data.UserSub,
        businessType: "Doctor",
        bussinessId,
      });

      if (!login) {
        res.status(500).json({ message: "Failed to create login credentials." });
        return;
      }

      const emailParams = {
        Source: process.env.MAIL_DRIVER as string,
        Destination: { ToAddresses: [username] },
        Message: {
          Subject: { Data: "Your password" },
          Body: {
            Text: {
              Data: `Your password is: ${loginCredentials.password}. Keep it safe.`,
            },
          },
        },
      };

      try {
        await SES.sendEmail(emailParams).promise();
      } catch (error: any) {
        console.error("Error sending email:", error);
      }

      const uploadToS3 = (file: File, folderName: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME as string,
            Key: `${folderName}/${Date.now()}_${file.name}`,
            Body: file.data,
            ContentType: file.mimetype,
          };

          s3.upload(params, (err: any, data: any) => {
            if (err) {
              console.error('Error uploading to S3:', err);
              // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
              reject(err);
            } else {
              resolve(data.Key);
            }
          });
        });
      };

      let image: string | undefined,
        cvFile: { name: string; type: string; date: Date } | undefined
      const documents: Document[] = [];

      if (req.files && (req.files as Files).profilePicture) {
        image = await uploadToS3((req.files as Files).profilePicture!, "profilePicture");
      }
      if (req.files && (req.files as Files).cvFile) {
        const files = await uploadToS3((req.files as Files).cvFile!, "cv");
        cvFile = {
          name: files,
          type: (req.files as Files).cvFile!.mimetype,
          date: new Date(),
        };
      }
      if (req.files && (req.files as Files).document) {
        const documentFiles = Array.isArray((req.files as Files).document)
          ? (req.files as Files).document
          : [(req.files as Files).document];

        for (let file of documentFiles as File[]) {
          const documentKey = await uploadToS3(file, "documents");
          documents.push({
            name: documentKey,
            type: file.mimetype,
            date: new Date(),
          });
        }
      }

      const newDoctor = new AddDoctors({
        userId: data.UserSub,
        personalInfo: { ...personalInfo, image },
        residentialAddress,
        professionalBackground: {
          ...professionalBackground,
          specialization: parsedData.professionalBackground.specialization,
          specializationId: parsedData.professionalBackground.specializationId,
        },
        availability,
        timeDuration: timeDuration?.value,
        consultFee,
        authSettings,
        documents,
        bussinessId,
        activeModes,
        cvFile,
      });

      const savedDoctor = await newDoctor.save();

      res.status(201).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "information",
            code: "informational",
            details: {
              text: "Doctor added successfully",
            },
          },
        ],
        doctor: savedDoctor,
      });
    } catch (error: any) {
      console.error("Error saving doctor:", error);
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: error.message,
            },
          },
        ],
      });
    }
  },

  
//  getOverview : async (req: Request, res: Response): Promise<Response> => {
//   const subject = req.query.subject as string;
//   const reportType = req.query.reportType as string;

//   if (!subject || !reportType) {
//     return res.status(400).json({ message: 'Missing required query parameters' });
//   }

//   const match = subject.match(/^Organization\/(.+)$/);
//   if (!match) {
//     return res.status(400).json({
//       resourceType: 'OperationOutcome',
//       reportType,
//       issue: [
//         {
//           severity: 'error',
//           code: 'invalid-subject',
//           details: {
//             text: 'Invalid subject format. Expected Organization/12345',
//           },
//         },
//       ],
//     });
//   }

//   const organizationId = match[1];

//   try {
//     const aggregation = await AddDoctors.aggregate([
//       {
//         $match: { bussinessId: organizationId },
//       },
//       {
//         $group: {
//           _id: '$professionalBackground.specialization',
//         },
//       },
//       {
//         $count: 'totalSpecializations',
//       },
//     ]);

//     const totalDoctors = await AddDoctors.countDocuments({
//       bussinessId: organizationId,
//     });

//     const availableDoctors = await AddDoctors.countDocuments({
//       bussinessId: organizationId,
//       isAvailable: '1',
//     });

//     const overview = {
//       totalDoctors,
//       totalSpecializations: aggregation[0]?.totalSpecializations || 0,
//       availableDoctors,
//     };

//     const converter = new FHIRConverter(overview);
//     const response = converter.overviewConvertToFHIR();

//     return res.status(200).json(response); // No need to stringify, Express handles objects
//   } catch (error: any) {
//     console.error('Error fetching overview data:', error);
//     return res.status(500).json({
//       resourceType: 'OperationOutcome',
//       issue: [
//         {
//           severity: 'error',
//           code: 'exception',
//           details: {
//             text: error.message,
//           },
//         },
//       ],
//     });
//   }
// },
  getForAppDoctorsBySpecilizationId: async (req, res) => {
    try {
      const { userId, value } = req.query.params;

      const doctors = await AddDoctors.find({
        "professionalBackground.specialization": { $exists: true, $eq: value },
        bussinessId: { $exists: true, $eq: userId },
      }).select("userId personalInfo.firstName personalInfo.lastName");

      if (!doctors || doctors.length === 0) {
        return res
          .status(404)
          .json({ message: "No doctors found for this specialization" });
      }

      return res.status(200).json(doctors);
    } catch (error) {
      console.error("Error fetching doctors by specialization ID:", error);

      return res.status(500).json({ message: "Internal server error", error });
    }
  },
  getDoctorsBySpecilizationId: async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      const doctors = await AddDoctors.find({
        "professionalBackground.specialization": { $exists: true, $eq: id },
        bussinessId: { $exists: true, $eq: userId },
      }).select("userId personalInfo.firstName personalInfo.lastName");

      if (!doctors || doctors.length === 0) {
        return res
          .status(404)
          .json({ message: "No doctors found for this specialization" });
      }

      return res.status(200).json(doctors);
    } catch (error) {
      // console.error('Error fetching doctors by specialization ID:', error);

      return res.status(500).json({ message: "Internal server error", error });
    }
  },
  searchDoctorsByName: async (req, res) => {

    try {
      const { name, bussinessId } = req.query;
      // console.log('name', name, bussinessId);

      if (
        typeof bussinessId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(bussinessId)
      ) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }

      if (name && typeof name !== "string") {
        return res.status(400).json({ message: "Invalid name format" });
      }

      if (!bussinessId) {
        return res.status(400).json({ message: "Business ID is required" });
      }

      const [firstName = "", lastName = ""] = name ? name.split(" ") : "";

      const searchFilter = {
        bussinessId,
        $or: [
          { "personalInfo.firstName": { $regex: firstName, $options: "i" } },
          { "personalInfo.lastName": { $regex: lastName, $options: "i" } },
        ],
      };

      const doctors = await AddDoctors.find(searchFilter).select(
        "personalInfo.firstName personalInfo.lastName personalInfo.image professionalBackground.specialization professionalBackground.qualification userId isAvailable"
      );

      const specializationIds = [
        ...new Set(
          doctors
            .map((doctor) => doctor.professionalBackground?.specialization)
            .filter(Boolean) // Removes undefined/null values
        ),
      ];

      // Fetch department details
      const departments = await Department.find({
        _id: { $in: specializationIds },
      }).select("_id departmentName");

      const specializationMap = departments.reduce((acc, department) => {
        acc[department._id] = department.departmentName;
        return acc;
      }, {});

      function getS3Url(fileKey) {
        
        return fileKey ? `${process.env.CLOUD_FRONT_URI}/${fileKey}`: null;
      }
      const doctorDataWithSpecializations = doctors.map((doctor) => {
        const specializationId = doctor.professionalBackground?.specialization;
        return {
          userId: doctor.userId,
          isAvailable: doctor.isAvailable,
          doctorName: `${doctor.personalInfo.firstName} ${doctor.personalInfo.lastName}`,
          qualification: doctor.professionalBackground?.qualification || "N/A",
          specialization:
            specializationMap[specializationId] || "No specialization found",
          image: doctor.personalInfo.image
            ? getS3Url(doctor.personalInfo.image)
            : "",
        };
      });

      // Grouping doctors by specialization
      const groupedBySpecialization = doctorDataWithSpecializations.reduce(
        (acc, doctor) => {
          const { specialization } = doctor;
          if (!acc[specialization]) {
            acc[specialization] = [];
          }
          acc[specialization].push(doctor);
          return acc;
        },
        {}
      );


      const data = new FHIRConverter(groupedBySpecialization);

      const fhirData = data.convertToFHIR();

      res.status(200).json(fhirData);
    } catch (error) {
      console.error("Error fetching doctors data:", error);

      const operationOutcome = {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "processing",
            diagnostics: "Failed to fetch doctors data",
            details: {
              text: error.message || "Unknown error",
            },
          },
        ],
      };

      res.status(500).json(operationOutcome);
    }
  },

  getDoctors: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // console.log('Fetching doctor data for User ID:', id);

      const doctor = await AddDoctors.findOne({ userId: id }).lean();

      if (doctor) {
        const department = await Department.findOne({
          _id: doctor?.professionalBackground?.specialization,
        });

        if (doctor.personalInfo.image) {
          const imageUrl = `${process.env.CLOUD_FRONT_URI}/${doctor.personalInfo.image}`
          const updatedDocuments = doctor.documents?.map((doc) => {
            const signedUrl = s3.getSignedUrl("getObject", {
              Bucket: process.env.AWS_S3_BUCKET_NAME,
              Key: doc.name,
            });

            return {
              _id: doc._id,
              name: signedUrl,
              type: doc.type,
              date: doc.date,
            };
          });

          const data = JSON.stringify(
            {
              ...doctor._doc,
              timeDuration: doctor.timeDuration,
              availability: doctor.availability,
              residentialAddress: doctor.residentialAddress,
              personalInfo: { ...doctor.personalInfo, image: imageUrl },
              professionalBackground: {
                ...doctor.professionalBackground,
                specialization: department?.departmentName,
              },
              documents: updatedDocuments,
            },
            null,
            2
          );

          const fhirDoctor = FHIRConverter.toFHIR(JSON.parse(data));
          const fhirDocuments = FHIRConverter.documentsToFHIR(
            JSON.parse(data).documents
          );
          const fhirSchedule = FHIRConverter.availabilityToFHIR(
            JSON.parse(data).availability
          );
          return res.status(200).json({
            // ...doctor._doc,
            // timeDuration: doctor.timeDuration,
            // availability: doctor.availability,
            // residentialAddress: doctor.residentialAddress,
            // personalInfo: { ...doctor.personalInfo, image: imageUrl },
            // professionalBackground: {
            //   ...doctor.professionalBackground,
            //   specialization: department?.departmentName,
            // },
            // documents: updatedDocuments,
            fhirDoctor: fhirDoctor,
            fhirDocuments: fhirDocuments,
            fhirSchedule: fhirSchedule,
          });
        }
      } else {
        // console.log('No doctor found for User ID:', id);
        return res.status(404).json({ message: "Doctor not found" });
      }
    } catch (error) {
      console.error("Error fetching doctor data:", error);
      return res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: error.message,
            }
          }
        ]
      });
    }
  },

  deleteDocumentsToUpdate: async (req, res) => {
    const { userId, docId } = req.params;

    try {
      const user = await AddDoctors.findOne({ userId }).lean();

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.documents || user.documents.length === 0) {
        return res
          .status(404)
          .json({ message: "No documents found for this user" });
      }

      const documentToDelete = user.documents.find(
        (doc) => doc._id.toString() === docId
      );

      if (!documentToDelete) {
        return res.status(404).json({ message: "Document not found" });
      }

      const s3Key = documentToDelete.name;
      // console.log('S3 Key to delete:', s3Key);

      const deleteParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
      };

      try {
        const headObject = await s3.headObject(deleteParams).promise();
        // console.log('S3 File Found:', headObject);
      } catch (headErr) {
        console.error("S3 File Not Found:", headErr);
        return res.status(404).json({ message: "File not found in S3" });
      }

      try {
        const deleteResponse = await s3.deleteObject(deleteParams).promise();
        // console.log('S3 Delete Response:', deleteResponse);
      } catch (deleteErr) {
        console.error("S3 Deletion Error:", deleteErr);
        return res
          .status(500)
          .json({ message: "Failed to delete file from S3", error: deleteErr });
      }

      const updatedUser = await AddDoctors.findOneAndUpdate(
        { userId },
        { $pull: { documents: { _id: docId } } },
        { new: true }
      );

      if (!updatedUser) {
        return res
          .status(404)
          .json({ message: "Document not found in the database" });
      }

      // console.log('Document deleted successfully from both database and S3');
      res.status(200).json({
        message: "Document deleted successfully from both database and S3",
        updatedUser,
      });
    } catch (err) {
      console.error("Unexpected Error:", err);
      res.status(500).json({
        message: "An error occurred while deleting the document",
        error: err,
      });
    }
  },
  updateDoctorProfile: async (req, res) => {
    const userId = req.params.id;

    if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
      return res.status(400).json({ message: "Invalid doctorId format" });
    }

    const formData = req.body.formData ? JSON.parse(req.body.formData) : {};
    const data = FHIRConverter.fromFhir(formData);

    const { personalInfo, residentialAddress, professionalBackground } = data;

    // console.log('Received Data:', formData, req.files, userId);

    // Helper function to upload files to S3
    const uploadToS3 = (file, folderName) => {
      return new Promise((resolve, reject) => {
        const params = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: `${folderName}/${Date.now()}_${file.name}`,
          Body: file.data,
          ContentType: file.mimetype,
        };

        s3.upload(params, (err, data) => {
          if (err) {
            console.error("Error uploading to S3:", err);
            reject(err);
          } else {
            resolve(data.Key);
          }
        });
      });
    };

    // Helper function to delete a file from S3
    const deleteFromS3 = async (key) => {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
      };
      try {
        await s3.deleteObject(params).promise();
        // console.log(`Deleted S3 object: ${key}`);
      } catch (err) {
        console.error("Error deleting S3 object:", err);
      }
    };

    let uploadedImageKey = null;
    const uploadedDocuments = [];

    try {
      if (req.files && req.files.image) {
        uploadedImageKey = await uploadToS3(req.files.image, "images");
      }
      if (req.files && req.files.document) {
        const documentFiles = Array.isArray(req.files.document)
          ? req.files.document
          : [req.files.document];

        for (let file of documentFiles) {
          const documentKey = await uploadToS3(file, "documents");
          uploadedDocuments.push({
            name: documentKey,
            type: file.mimetype,
            date: new Date(),
          });
        }
      }

      const specialization = await Department.findOne({
        departmentName: professionalBackground.specialization,
      });

      if (!specialization) {
        return res.status(400).json({
          message: "Invalid specialization provided",
        });
      }

      // Find existing doctor profile
      const existingDoctor = await AddDoctors.findOne({ userId });
      if (!existingDoctor) {
        return res.status(404).json({
          message: "Doctor profile not found",
        });
      }

      var oldImageKey = existingDoctor.personalInfo?.image;

      const updateResult = await AddDoctors.updateOne(
        { userId },
        {
          $set: {
            personalInfo: {
              ...personalInfo,
              image: uploadedImageKey || oldImageKey,
            },
            residentialAddress,
            professionalBackground: {
              ...professionalBackground,
              specialization: specialization._id,
            },
          },
          $push: {
            documents: {
              $each: uploadedDocuments,
            },
          },
        }
      );

      if (updateResult) {
        if (uploadedImageKey && oldImageKey) {
          await deleteFromS3(oldImageKey);
        }
        // console.log('Doctor profile updated successfully');
        return res.status(200).json({
          message: "Doctor profile updated successfully",
        });
      } else {
        // console.log('falieddd');
        return res.status(400).json({
          message: "Failed to update doctor profile",
        });
      }
    } catch (error) {
      console.error("Error updating doctor profile:", error);
      return res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: {
              text: error.message,
            },
          },
        ],
      });
    }
  },

  AddDoctorsSlote: async (req, res) => {
    try {
      const { day, slots } = req.body;
      const doctorId = req.params.id;

      if (
        typeof doctorId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(doctorId)
      ) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }

      const validDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      if (typeof day !== "string" || !validDays.includes(day)) {
        return res.status(400).json({ message: "Invalid day value" });
      }

      // console.log("day doctors",day, doctorId)
      const formattedSlots = slots.entry.map((entry) => {
        const resource = entry.resource || entry;
        const dateObj = new Date(resource.start);

        const hours24 = dateObj.getHours().toString().padStart(2, "0");
        const minutes = dateObj.getMinutes().toString().padStart(2, "0");
        const time24 = `${hours24}:${minutes}`;
        const time = convertTo12HourFormat(dateObj); // AM/PM format

        return {
          ...resource,
          time,
          time24,
          selected: resource.status === "true",
        };
      });

      let existingRecord = await DoctorsTimeSlotes.findOne({ doctorId, day });

      if (existingRecord) {
        const incomingTimes = formattedSlots.map((slot) => slot.time);
        const existingTimes = existingRecord.timeSlots.map((slot) => slot.time);

        const slotsToRemove = existingTimes.filter(
          (time) => !incomingTimes.includes(time)
        );

        const updatedSlots = existingRecord.timeSlots.map((existingSlot) => {
          const incomingSlot = formattedSlots.find(
            (slot) => slot.time === existingSlot.time
          );
          if (incomingSlot) {
            existingSlot.selected = incomingSlot.selected;
            existingSlot.time24 = incomingSlot.time24;
          }
          return existingSlot;
        });

        const newSlots = formattedSlots.filter(
          (slot) => !existingTimes.includes(slot.time)
        );
        updatedSlots.push(...newSlots);

        const finalSlots = updatedSlots.filter(
          (slot) => !slotsToRemove.includes(slot.time)
        );

        existingRecord.timeSlots = finalSlots;
        await existingRecord.save();

        return res.status(200).json({
          message: "Slots updated successfully.",
          data: existingRecord,
        });
      } else {
        const newRecord = new DoctorsTimeSlotes({
          doctorId,
          day,
          timeSlots: formattedSlots,
        });
        await newRecord.save();

        return res.status(201).json({
          message: "New slots created successfully.",
          data: newRecord,
        });
      }
    } catch (error) {
      console.error("Error in AddDoctorsSlot:", error);
      return res.status(500).json({
        message: "An error occurred while adding/updating slots.",
        error: error.message,
      });
    }
  },
  getDoctorsSlotes: async (req, res) => {
    try {
      const { doctorId, day, date } = req.query;

      if (
        typeof doctorId !== "string" ||
        !/^[a-fA-F0-9-]{36}$/.test(doctorId)
      ) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }

      // Validate day (valid weekday name)
      const validDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      if (typeof day !== "string" || !validDays.includes(day)) {
        return res.status(400).json({ message: "Invalid day value" });
      }

      // Validate date (YYYY-MM-DD)
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res
          .status(400)
          .json({ message: "Invalid date format. Expected YYYY-MM-DD" });
      }

      const bookedSlots = await webAppointments.find({
        veterinarian: doctorId,
        appointmentDate: date,
      });
      // console.log('bookedSlots', bookedSlots);

      const response = await DoctorsTimeSlotes.findOne({ doctorId, day });
      console.log("response", response);

      if (response) {
        const bookedSlotIds = bookedSlots.map((slot) => slot.slotsId);

        const updatedTimeSlots = response.timeSlots.map((slot) => ({
          ...slot.toObject(),
          isBooked: bookedSlotIds.includes(slot._id.toString()),
        }));

        return res.status(200).json({
          message: "Data fetched successfully",
          timeSlots: updatedTimeSlots,
        });
      } else {
        return res.status(404).json({
          // message: "Data fetch Failed",
          // timeSlots: [],
        });
      }
    } catch (error) {
      console.error("Error in getDoctorsSlotes:", error);
      return res.status(500).json({
        message: "An error occurred while fetching slots.",
        error: error.message,
      });
    }
  },

  getAppointmentsForDoctorDashboard: async (req, res) => {
    try {
      const { doctorId, offset = 0, limit = 5 } = req.query;
      // console.log(req.query);

      const parsedOffset = parseInt(offset, 10);
      const parsedLimit = parseInt(limit, 10);

      const response = await webAppointments.aggregate([
        {
          $match: {
            veterinarian: doctorId,
            isCanceled: { $eq: 0 }, // Exclude appointments where isCanceled is 2
          },
        },
        {
          $addFields: {
            departmentObjId: { $toObjectId: "$department" },
          },
        },
        {
          $lookup: {
            from: "adddoctors",
            localField: "veterinarian",
            foreignField: "userId",
            as: "doctorInfo",
          },
        },
        {
          $lookup: {
            from: "departments",
            localField: "departmentObjId",
            foreignField: "_id",
            as: "departmentInfo",
          },
        },
        {
          $unwind: {
            path: "$doctorInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: "$departmentInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [{ $skip: parsedOffset }, { $limit: parsedLimit }],
          },
        },
        {
          $project: {
            total: { $arrayElemAt: ["$metadata.total", 0] },
            Appointments: {
              $map: {
                input: "$data",
                as: "appointment",
                in: {
                  _id: "$$appointment._id",
                  tokenNumber: "$$appointment.tokenNumber",
                  petName: "$$appointment.petName",
                  ownerName: "$$appointment.ownerName",
                  slotsId: "$$appointment.slotsId",
                  petType: "$$appointment.petType",
                  breed: "$$appointment.breed",
                  purposeOfVisit: "$$appointment.purposeOfVisit",
                  appointmentDate: {
                    $dateToString: {
                      format: "%d %b %Y",
                      date: { $toDate: "$$appointment.appointmentDate" },
                    },
                  },
                  appointmentTime: "$$appointment.appointmentTime",
                  appointmentStatus: "$$appointment.appointmentStatus",
                  department: "$$appointment.departmentInfo.departmentName",
                  veterinarian: {
                    $concat: [
                      "$$appointment.doctorInfo.personalInfo.firstName",
                      " ",
                      "$$appointment.doctorInfo.personalInfo.lastName",
                    ],
                  },
                },
              },
            },
          },
        },
      ]);

      if (!response.length || !response[0].Appointments.length) {
        return res
          .status(404)
          .json({ message: "No slots found for the doctor." });
      }

      return res.status(200).json({
        message: "Data fetched successfully",
        totalAppointments: response[0].total || 0,
        Appointments: response[0].Appointments,
      });
    } catch (error) {
      console.error("Error in getAppointmentsForDoctorDashboard:", error);
      return res.status(500).json({
        message: "An error occurred while fetching slots.",
        error: error.message,
      });
    }
  },
  // getLast7DaysAppointmentsTotalCount: async (req, res) => {

  // },
  AppointmentAcceptedAndCancelFHIR: async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;
      const { status } = req.body;

      const appointment = await webAppointments.findByIdAndUpdate(
        id,
        {
          $set: {
            appointmentStatus: status === "cancelled" ? "cancelled" : "booked", // or "accepted" if preferred
            cancelledBy: userId,
          },
        },
        { new: true }
      );

      if (appointment) {
        return res.status(200).json({
          message: "Appointment status updated successfully.",
          appointment,
        });
      } else {
        return res.status(404).json({ message: "Appointment not found." });
      }
    } catch (error) {
      console.error("Error in AppointmentAcceptedAndCancelFHIR:", error);
      return res.status(500).json({
        message: "An error occurred while updating appointment status.",
        error: error.message,
      });
    }
  },
  updateAvailability: async (req, res) => {
    try {
      const { userId, status } = req.query;

      // console.log("userid", userId, "status",status)
      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }

      const result = await AddDoctors.updateOne(
        { userId: userId },
        { $set: { isAvailable: status } }
      );

      // console.log('Update Result:', result);

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "User not found." });
      }

      return res.status(200).json({
        message: "Availability updated successfully.",
        // isAvailable: status,
      });
    } catch (error) {
      console.error("Error in updateAvailability:", error);
      return res.status(500).json({
        message: "An error occurred while updating user availability.",
        error: error.message,
      });
    }
  },
  getAvailabilityStatus: async (req, res) => {
    try {
      const { userId } = req.query;

      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }

      const result = await AddDoctors.findOne({ userId: userId });
      console.log("Availability Status:", result);
      if (!result) {
        return res.status(404).json({ message: "User not found." });
      }
      return res.status(200).json({
        message: "Availability status retrieved successfully.",
        isAvailable: result.isAvailable,
      });
    } catch (error) {
      console.error("Error in getAvailabilityStatus:", error);
      return res.status(500).json({
        message: "An error occurred while retrieving user availability status.",
        error: error.message,
      });
    }
  },
};

module.exports = AddDoctorsController;
