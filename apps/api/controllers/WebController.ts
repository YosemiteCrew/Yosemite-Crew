import AWS from "aws-sdk";
import crypto from "crypto";
import bcrypt from "bcrypt";
import validator from "validator";
import { S3 } from "aws-sdk";
import { Request, Response } from "express";
// const axios = require("axios");
// import { validateFHIR } from "../Fhirvalidator/FhirValidator";
import jwt, { SignOptions } from "jsonwebtoken";
import { WebUser, ProfileData } from "../models/WebUser";
import {
  ConfirmForgotPasswordCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommandInput
} from "@aws-sdk/client-cognito-identity-provider";
import { HospitalProfileFHIRBuilder } from "@yosemite-crew/fhir";
const cognitoo = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});
import dotenv from 'dotenv';
dotenv.config();
import type { FHIRProfileParser, IProfileData, register, UploadedFile } from '@yosemite-crew/types'
import { HospitalProfile } from "@yosemite-crew/fhir/dist/hospital.profile.type";

const cognito = new AWS.CognitoIdentityServiceProvider();

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
});


const WebController = {
  Register: async (
    req: Request<register>,
    res: Response
  ): Promise<Response> => {
    try {
      console.log("hello")
      const { email, password, businessType } = req.body as register;
       console.log(email,password,businessType)
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required." });
      }

      console.log("Checking if user exists in Cognito...");

      try {
        const params: AWS.CognitoIdentityServiceProvider.AdminGetUserRequest = {
          UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB as string,
          Username: email,
        };

        const userData = await cognito.adminGetUser(params).promise();
        console.log("User found in Cognito:", userData);

        const emailVerified = userData.UserAttributes?.find(
          (attr) => attr.Name === "email_verified"
        )?.Value === "true";

        console.log("Email verified status:", emailVerified);

        if (emailVerified) {
          return res
            .status(409)
            .json({ message: "User already exists. Please login." });
        }

        // Resend OTP
        console.log("User exists but is not verified. Resending OTP...");
        const resendParams: AWS.CognitoIdentityServiceProvider.ResendConfirmationCodeRequest = {
          ClientId: process.env.COGNITO_CLIENT_ID_WEB as string,
          Username: email,
        };

        if (process.env.COGNITO_CLIENT_SECRET) {
          resendParams.SecretHash = getSecretHash(email);
        }

        await cognito.resendConfirmationCode(resendParams).promise();

        return res
          .status(200)
          .json({ message: "New OTP sent to your email." });

      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code !== "UserNotFoundException"
        ) {
          console.error("Error checking Cognito user:", err);
          return res
            .status(500)
            .json({ message: "Error checking user status." });
        }
        // if it's "UserNotFoundException", continue to signup logic
      }

      // Register new user
      console.log("User not found. Proceeding with registration...");

      const signUpParams: AWS.CognitoIdentityServiceProvider.SignUpRequest = {
        ClientId: process.env.COGNITO_CLIENT_ID_WEB as string,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: "email", Value: email }],
      };

      if (process.env.COGNITO_CLIENT_SECRET) {
        signUpParams.SecretHash = getSecretHash(email);
      }

      let data;
      try {
        data = await cognito.signUp(signUpParams).promise();
        console.log("User successfully registered in Cognito:", data);
      } catch (err) {
        console.error("Cognito Signup Error:", err);

        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "UsernameExistsException"
        ) {
          return res.status(409).json({
            message: "User already exists in Cognito. Please verify your email.",
          });
        }

        return res.status(500).json({
          message: "Error registering user. Please try again later.",
        });
      }

      // Save user to MongoDB
      const newUser = new WebUser({
        cognitoId: data.UserSub,
        businessType,
      });

      await newUser.save();

      return res.status(200).json({
        message: "User registered successfully! Please verify your email with OTP.",
      });

    } catch (error) {
      console.error("Unexpected Error:", error);
      return res
        .status(500)
        .json({ message: "Internal Server Error. Please try again later." });
    }
  },

  verifyUser: async (
    req: Request<register>,
    res: Response
  ): Promise<Response> => {
    try {
      const { email, otp } = req.body as register;

      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required." });
      }

      console.log("Verifying OTP for email:", email);

      const secretHash = getSecretHash(email);

      const getUserParams: AWS.CognitoIdentityServiceProvider.AdminGetUserRequest = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB as string,
        Username: email,
      };

      let cognitoId: string | undefined;
      let isUserVerified = false;

      try {
        const userData = await cognito.adminGetUser(getUserParams).promise();
        console.log("Cognito User Data:", JSON.stringify(userData, null, 2));

        const emailVerified = userData.UserAttributes?.find(
          (attr) => attr.Name === "email_verified"
        )?.Value === "true";

        isUserVerified = emailVerified ?? false;

        cognitoId = userData.UserAttributes?.find(
          (attr) => attr.Name === "sub"
        )?.Value;

        if (!cognitoId) {
          console.error("Cognito ID (sub) not found.");
          return res.status(500).json({ message: "Cognito ID not found." });
        }

        console.log("Cognito ID:", cognitoId);
      } catch (err) {
        console.error("Error retrieving Cognito user:", err);
        return res
          .status(500)
          .json({ message: "Error retrieving user details." });
      }

      if (!isUserVerified) {
        const confirmParams: AWS.CognitoIdentityServiceProvider.ConfirmSignUpRequest = {
          ClientId: process.env.COGNITO_CLIENT_ID_WEB as string,
          SecretHash: secretHash,
          Username: email,
          ConfirmationCode: String(otp),
        };

        try {
          await cognito.confirmSignUp(confirmParams).promise();
          console.log("User confirmed with OTP");
        } catch (err) {
          console.error("Cognito Verification Error:", err);
          return res
            .status(400)
            .json({ message: "Invalid OTP or user already verified." });
        }
      }

      const user = await WebUser.findOne({ cognitoId });

      if (!user) {
        return res.status(404).json({ message: "User not found in the system" });
      }

      const sec = process.env.JWT_SECRET;
      const expireIn = (process.env.EXPIRE_IN ?? "1h") as jwt.SignOptions["expiresIn"];

      if (!sec) {
        throw new Error("JWT_SECRET is not defined in environment variables");
      }

      const payload = {
        userId: cognitoId,
        email,
        userType: user.businessType,
      };

      const signOptions: SignOptions = {
        expiresIn: expireIn,
      };

      const token = jwt.sign(payload, sec, signOptions);
      return res.status(200).json({
        message: "User verified successfully!",
        token,
        cognitoId,
      });
    } catch (error) {
      console.error("Unexpected Error:", error);
      return res
        .status(500)
        .json({ message: "Internal Server Error. Please try again later." });
    }
  },

  signIn: async (
    req: Request<register>,
    res: Response
  ): Promise<Response> => {
    try {
      const { email, password } = req.body as register;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      const secretHash = getSecretHash(email);

      const authParams: AWS.CognitoIdentityServiceProvider.InitiateAuthRequest = {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: process.env.COGNITO_CLIENT_ID_WEB as string,
        AuthParameters: {
          SECRET_HASH: secretHash,
          USERNAME: email,
          PASSWORD: password,
        },
      };

      const authData = await cognito.initiateAuth(authParams).promise();

      if (!authData.AuthenticationResult) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const userDetails = await cognito
        .adminGetUser({
          UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB as string,
          Username: email,
        })
        .promise();

      const cognitoId = userDetails.UserAttributes?.find(
        (attr) => attr.Name === "sub"
      )?.Value;

      if (!cognitoId) {
        return res
          .status(500)
          .json({ message: "Failed to retrieve Cognito ID" });
      }

      const user = await WebUser.findOne({ cognitoId });

      if (!user) {
        return res.status(404).json({ message: "User not found in the system" });
      }

      const sec = process.env.JWT_SECRET;
      const expireIn = (process.env.EXPIRE_IN ?? "1h") as jwt.SignOptions["expiresIn"];

      if (!sec) {
        throw new Error("JWT_SECRET is not defined in environment variables");
      }

      const payload = {
        userId: cognitoId,
        email,
        userType: user.businessType,
      };

      const signOptions: SignOptions = {
        expiresIn: expireIn,
      };

      const token = jwt.sign(payload, sec, signOptions);

      return res.status(200).json({
        token,
        message: "Logged in successfully",
      });
    } catch (error) {
      console.error("Error during sign-in:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "NotAuthorizedException"
      ) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      return res.status(500).json({ message: "Internal server error", error });
    }

  },

  signOut: (req: Request, res: Response): void => {
    try {
      const isProduction = process.env.NODE_ENV === "production";

      // Clear access and refresh tokens
      res.clearCookie("accessToken", {
        httpOnly: true,               // Recommended: prevent JS access
        secure: isProduction,         // Only send over HTTPS in production
        sameSite: "strict",
      });

      res.clearCookie("refreshToken", {
        httpOnly: true,               // Recommended: prevent JS access
        secure: isProduction,
        sameSite: "strict",
      });

      res.status(200).json({ message: "Logout successful" });
    } catch (error) {
      console.error("Error during sign-out:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
  forgotPassword: async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email } = req.body as { email: string };

      if (!email) {
        return res.status(400).json({ message: "Email is required." });
      }

      // Step 1: Check if user exists in Cognito
      const getUserParams: AWS.CognitoIdentityServiceProvider.AdminGetUserRequest = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB!,
        Username: email,
      };

      try {
        await cognito.adminGetUser(getUserParams).promise();
      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as AWS.AWSError).code === "UserNotFoundException"
        ) {
          return res.status(404).json({ message: "User not found in Cognito." });
        }

        console.error("Error checking user in Cognito:", err);
        return res
          .status(500)
          .json({ message: "Error checking user status in Cognito." });
      }

      // Step 2: Send password reset code
      const resetParams: AWS.CognitoIdentityServiceProvider.ForgotPasswordRequest = {
        ClientId: process.env.COGNITO_CLIENT_ID_WEB!,
        Username: email,
      };

      if (process.env.COGNITO_CLIENT_SECRET_WEB) {
        resetParams.SecretHash = getSecretHash(email);
      }

      await cognito.forgotPassword(resetParams).promise();

      return res.status(200).json({
        message:
          "Password reset code sent to your email. Please check your inbox.",
      });
    } catch (error) {
      console.error("Error during forgotPassword:", error);
      return res.status(500).json({
        message: "Error during password reset process",
        error:
          error instanceof Error ? error.message : "Unexpected error occurred",
      });
    }
  },

  verifyOtp: async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email, otp, password: newPassword } = req.body as {
        email: string;
        otp: string;
        password: string;
      };

      if (!email || !otp || !newPassword) {
        return res.status(400).json({
          message: "Email, OTP, and new password are required.",
        });
      }

      const params: ConfirmForgotPasswordCommandInput = {
        ClientId: process.env.COGNITO_CLIENT_ID_WEB!,
        Username: email,
        ConfirmationCode: otp.trim(),
        Password: newPassword,
      };

      if (process.env.COGNITO_CLIENT_SECRET_WEB) {
        params.SecretHash = getSecretHash(email);
      }

      await cognitoo.send(new ConfirmForgotPasswordCommand(params));

      return res.status(200).json({
        message: "Password reset successfully. You can now log in.",
      });
    } catch (error) {
      console.error("Error resetting password:", error);

      return res.status(500).json({
        message: "Error resetting password.",
        error:
          error instanceof Error ? error.message : "Unexpected error occurred",
      });
    }
  },
  // updatePassword: async (req: Request, res: Response): Promise<Response> => {
  //   try {
  //     const { email, password } = req.body as register;

  //     if (typeof email !== "string" || !validator.isEmail(email)) {
  //       return res.status(400).json({ status: 0, message: "Invalid email format" });
  //     }

  //     if (typeof password !== "string" || password.trim().length < 6) {
  //       return res.status(400).json({ message: "Invalid password. Minimum 6 characters required." });
  //     }

  //     const cleanedEmail = email.trim().toLowerCase();
  //     const existingUser = await WebUser.findOne({ email: cleanedEmail });

  //     if (!existingUser) {
  //       return res.status(404).json({ message: "User not found" });
  //     }

  //     const hashedPassword = await bcrypt.hash(password, 10);

  //     await WebUser.updateOne(
  //       { email: cleanedEmail },
  //       { $set: { password: hashedPassword } }
  //     );

  //     return res.status(200).json({ message: "Password updated successfully" });

  //   } catch (error: any) {
  //     console.error("Error updating password:", error);
  //     return res.status(500).json({ message: "Error updating password" });
  //   }
  // },

  setupProfile: async (req: Request, res: Response): Promise<void> => {
    try {
      const uploadToS3 = (file: UploadedFile, folderName: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const params: S3.Types.PutObjectRequest = {
            Bucket: process.env.AWS_S3_BUCKET_NAME!,
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

      let fhirData: HospitalProfileFHIRBuilder;
      try {
        fhirData = JSON.parse(req.body.fhirData);
      } catch (parseError) {
        res.status(400).json({
          message: "Invalid FHIR data format",
          error: (parseError as Error).message,
        });
      }

      const parser = new FHIRProfileParser(fhirData);
      const userId = parser.getUserId();

      if (!userId) {
        return res.status(400).json({ message: "Missing user ID in FHIR data" });
      }

      // Upload logo if present
      const logo = req.files?.logo && !Array.isArray(req.files.logo)
        ? await uploadToS3(req.files.logo as UploadedFile, "logo")
        : undefined;

      const prescriptionUpload: UploadedDoc[] = [];

      if (req.files?.attachments) {
        const attachments = Array.isArray(req.files.attachments)
          ? req.files.attachments
          : [req.files.attachments];

        for (const file of attachments) {
          const doc = file as UploadedFile;
          const key = await uploadToS3(doc, "prescription_upload");
          prescriptionUpload.push({
            name: key,
            type: doc.mimetype,
            date: new Date(),
          });
        }
      }

      const address = parser.getAddress();
      const { latitude, longitude } = parser.getCoordinates();

      const updatedProfile = await ProfileData.findOneAndUpdate(
        { userId },
        {
          $set: {
            businessName: parser.getBusinessName(),
            registrationNumber: parser.getRegistrationNumber(),
            yearOfEstablishment: parser.getYearOfEstablishment(),
            phoneNumber: parser.getPhoneNumber(),
            website: parser.getWebsite(),
            address: {
              addressLine1: address.line?.[0] || "",
              city: address.city || "",
              street: address.street || "",
              state: address.state || "",
              zipCode: address.postalCode || "",
              latitude,
              longitude,
            },
            activeModes: parser.getActiveModes(),
            selectedServices: parser.getSelectedServices(),
            logo,
          },
          $push: {
            prescription_upload: { $each: prescriptionUpload },
          },
        },
        { new: true, upsert: true }
      );

      if (!updatedProfile) {
        res.status(400).json({ message: "Profile update failed" });
        return;
      }

      res.status(200).json({
        message: "Profile updated successfully",
        profile: updatedProfile,
      });

    } catch (error) {
      const err = error as Error;
      console.error("Error updating profile:", err);
      res.status(500).json({
        message: "Internal server error",
        error: err.message,
      });
    }
  },

  // getProfile: async (req: Request, res: Response): Promise<void> => {
  //   try {
  //     const userId: string = req.params.id;

  //     if (!/^[a-fA-F0-9-]{36}$/.test(userId)) {
  //       res.status(400).json({ message: "Invalid doctorId format" });
  //       return;
  //     }

  //     const profile = await ProfileData.findOne({ userId }) as IProfileData;

  //     if (!profile) {
  //       res.status(404).json({ message: "Profile not found" });
  //       return;
  //     }
  //       console.log("profile", profile);
  //     const logoUrl = await (profile.logo) as IProfileData;

  //     const prescriptionUploadUrl = await Promise.all(
  //       profile.prescription_upload.map(async (file) => ({
  //         name: await getS3Url(file.name),
  //         type: file.type,
  //         date: file.date,
  //         _id: file._id,
  //       }))
  //     );

  //     res.status(200).json({
  //       ...profile.toObject(),
  //       logoUrl,
  //       prescriptionUploadUrl,
  //     });

  //   } catch (error) {
  //     console.error("Error getting profile:", error);
  //     res.status(500).json({ message: "Error retrieving profile" });
  //   }
  // },
  deleteDocumentsToUpdate: async (req: Request, res: Response) => {
    const { userId, docId } = req.params;
    console.log("User ID:", userId);
    console.log("Document ID:", docId);
    if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
      return res.status(400).json({ message: "Invalid doctorId format" });
    }

    try {
      const user = await ProfileData.findOne({ userId }).lean();

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.prescription_upload || user.prescription_upload.length === 0) {
        return res
          .status(404)
          .json({ message: "No documents found for this user" });
      }

      const documentToDelete = user.prescription_upload.find(
        (doc) => doc._id.toString() === docId
      );

      if (!documentToDelete) {
        return res.status(404).json({ message: "Document not found" });
      }

      const s3Key = documentToDelete.name;
      console.log("S3 Key to delete:", s3Key);

      const deleteParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
      };

      try {
        const headObject = await s3.headObject(deleteParams).promise();
        console.log("S3 File Found:", headObject);
      } catch (headErr) {
        console.error("S3 File Not Found:", headErr);
        return res.status(404).json({ message: "File not found in S3" });
      }

      try {
        const deleteResponse = await s3.deleteObject(deleteParams).promise();
        console.log("S3 Delete Response:", deleteResponse);
      } catch (deleteErr) {
        console.error("S3 Deletion Error:", deleteErr);
        return res
          .status(500)
          .json({ message: "Failed to delete file from S3", error: deleteErr });
      }

      const updatedUser = await ProfileData.findOneAndUpdate(
        { userId },
        { $pull: { prescription_upload: { _id: docId } } },
        { new: true }
      );

      if (!updatedUser) {
        return res
          .status(404)
          .json({ message: "Document not found in the database" });
      }

      console.log("Document deleted successfully from both database and S3");
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

  getHospitalProfileFHIR: async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }

      const profile = await ProfileData.findOne({ userId });
      if (!profile) {
        throw new Error("Profile not found");
      }

      const logo = profile.logo;
      const image = logo ? `${process.env.CLOUD_FRONT_URI}/${logo}` : undefined;

      profile.logo = image;
      if (!profile) {
        return res.status(404).json({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "not-found",
              details: { text: "Hospital profile not found" },
            },
          ],
        });
      }
      const fhirBuilder = new HospitalProfileFHIRBuilder(
        profile as HospitalProfile,
      );
      const fhirBundle = fhirBuilder.buildFHIRBundle() as HospitalProfile;
      res.status(200).json(fhirBundle);
    } catch (error) {
      console.error("Error fetching hospital profile:", error);
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            details: { text: "Internal server error while fetching profile." },
          },
        ],
      });
    }
  },

  //   getLocationdata: async (req:Request, res:Response) => {
  //     try {
  //       const placeId = req.query.placeid;
  //       const apiKey = GOOGLE_MAPS_API_KEY;
  //       const url = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=${apiKey}`;

  //       const response = await axios.get(url);
  //       const extractAddressDetails = (geoLocationResp) => {
  //         const addressResp = {
  //           address: "",
  //           street: "",
  //           city: "",
  //           state: "",
  //           zipCode: "",
  //           country: "",
  //           lat: geoLocationResp.geometry.location.lat,
  //           long: geoLocationResp.geometry.location.lng,
  //         };

  //         const address_components = geoLocationResp.address_components || [];

  //         address_components.forEach((component) => {
  //           const types = component.types;

  //           if (types.includes("route")) {
  //             addressResp.street = component.long_name;
  //           }
  //           if (types.includes("locality")) {
  //             addressResp.city = component.long_name;
  //           }
  //           if (types.includes("administrative_area_level_1")) {
  //             addressResp.state = component.short_name;
  //           }
  //           if (types.includes("postal_code")) {
  //             addressResp.zipCode = component.long_name;
  //           }
  //           if (types.includes("country")) {
  //             addressResp.country = component.long_name;
  //           }
  //         });

  //         return addressResp;
  //       };
  //       const data = extractAddressDetails(response.data.result);
  //       res.json(data);
  //     } catch (error) {
  //       res.status(500).json({ error: error.message });
  //     }
  //   },
};
function getSecretHash(email: string,) {
  const clientId = process.env.COGNITO_CLIENT_ID_WEB;
  const clientSecret: string = process.env.COGNITO_CLIENT_SECRET_WEB as string
  return crypto
    .createHmac("SHA256", clientSecret)
    .update(email + clientId)
    .digest("base64");
}

export default WebController;
