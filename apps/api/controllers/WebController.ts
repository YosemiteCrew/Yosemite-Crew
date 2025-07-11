/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import AWS from "aws-sdk";
import crypto from "crypto";
import { S3 } from "aws-sdk";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { WebUser, ProfileData } from "../models/WebUser";
import {
  ConfirmForgotPasswordCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommandInput
} from "@aws-sdk/client-cognito-identity-provider";
import { fromFHIRBusinessProfile, toFHIRBusinessProfile } from "@yosemite-crew/fhir";
const cognitoo = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});
import dotenv from 'dotenv';
dotenv.config();
import type { BusinessProfile, FhirOrganization, register, UploadedFile } from '@yosemite-crew/types'
// import { validateFHIR } from "../Fhirvalidator/FhirValidator";

const cognito = new AWS.CognitoIdentityServiceProvider();

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
});

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const ACCESS_SECRET = process.env.JWT_SECRET as string;
const ACCESS_EXPIRY = process.env.EXPIRE_IN ?? "15m"; // short-lived
const REFRESH_EXPIRY = process.env.EXPIRE_IN_REFRESH; // longer-lived
const WebController = {
  Register: async (
    req: Request<register>,
    res: Response
  ): Promise<Response> => {
    try {

      const { email, password, role, subscribe } = req.body as register;

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

      if (typeof subscribe !== "boolean") {
        return res.status(400).json({ message: "Subscribe value must be true or false." });
      }
      if (typeof role !== "string") {
        return res.status(400).json({ message: "role value must be string." });
      }

      const newUser = new WebUser({
        cognitoId: data.UserSub,
        role,
        subscribe,
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


      const payload = {
        userId: cognitoId,
        email,
        userType: user.role,
      };

      if (!ACCESS_SECRET || !REFRESH_SECRET) {
        return res.status(500).json({ message: "JWT secrets not configured." });
      }
      const accessToken = jwt.sign(payload, ACCESS_SECRET, {
        expiresIn: ACCESS_EXPIRY,
      } as jwt.SignOptions);

      const refreshToken = jwt.sign(payload, REFRESH_SECRET, {
        expiresIn: REFRESH_EXPIRY,
      } as jwt.SignOptions);

      // ✅ Set secure cookies
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 1000 * 60 * 15, // 15 minutes
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });

      return res.status(200).json({
        data: {
          userId: cognitoId,
          email,
          userType: user.role,
        }, message: "Logged in successfully"
      });
    } catch (error) {
      console.error("Unexpected Error:", error);
      return res
        .status(500)
        .json({ message: "Internal Server Error. Please try again later." });
    }
  },

  signIn: async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      const secretHash = getSecretHash(email);

      const authData = await new AWS.CognitoIdentityServiceProvider()
        .initiateAuth({
          AuthFlow: "USER_PASSWORD_AUTH",
          ClientId: process.env.COGNITO_CLIENT_ID_WEB!,
          AuthParameters: {
            SECRET_HASH: secretHash,
            USERNAME: email,
            PASSWORD: password,
          },
        })
        .promise();

      if (!authData.AuthenticationResult) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const userDetails = await new AWS.CognitoIdentityServiceProvider()
        .adminGetUser({
          UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB!,
          Username: email,
        })
        .promise();

      const cognitoId = userDetails.UserAttributes?.find(
        (attr) => attr.Name === "sub"
      )?.Value;

      if (!cognitoId) {
        return res.status(500).json({ message: "Failed to retrieve Cognito ID" });
      }

      const user = await WebUser.findOne({ cognitoId });
      if (!user) {
        return res.status(404).json({ message: "User not found in the system" });
      }

      const payload = {
        userId: cognitoId,
        email,
        userType: user.role,
      };

      // ✅ Create tokens
      if (!ACCESS_SECRET || !REFRESH_SECRET) {
        return res.status(500).json({ message: "JWT secrets not configured." });
      }
      const accessToken = jwt.sign(payload, ACCESS_SECRET, {
        expiresIn: ACCESS_EXPIRY,
      } as jwt.SignOptions);

      const refreshToken = jwt.sign(payload, REFRESH_SECRET, {
        expiresIn: REFRESH_EXPIRY,
      } as jwt.SignOptions);

      // ✅ Set secure cookies
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 1000 * 60 * 15, // 15 minutes
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });

      return res.status(200).json({
        data: {
          userId: cognitoId,
          email,
          userType: user.role,
        }, message: "Logged in successfully"
      });
    } catch (error) {
      console.error("Error during sign-in:", error);

      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "NotAuthorizedException") {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      return res.status(500).json({ message: "Internal server error" });
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

  setupProfile: async (req: Request, res: Response): Promise<void> => {
    try {
      // S3 Upload Helper
      const uploadToS3 = (file: UploadedFile, folderName: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME!,
            Key: `${folderName}/${Date.now()}_${file.name}`,
            Body: file.data,
            ContentType: file.mimetype,
          };

          s3.upload(
            params,
            (err: Error, data: AWS.S3.ManagedUpload.SendData) => {
              if (err) {
                console.error("Error uploading to S3:", err);
                return reject(err);
              }
              if (data) {
                resolve(data.Key);
              } else {
                reject(new Error("S3 upload failed, no data returned."));
              }
            }
          );
        });
      };

      // Step 1: Parse FHIR JSON Payload
      let parsedPayload: unknown;
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        parsedPayload = JSON.parse(req.body.fhirPayload);
      } catch (error) {
        res.status(400).json({
          message: "Invalid JSON in fhirPayload",
          error: (error as Error).message,
        });
        return;
      }

      // Step 2: Convert to Internal Format
      let businessProfile: BusinessProfile;
      try {
         
        businessProfile = fromFHIRBusinessProfile(parsedPayload as FhirOrganization);
      } catch (error) {
        res.status(400).json({
          message: "Invalid FHIR structure",
          error: (error as Error).message,
        });
        return;
      }

      const {
        name,
        country,
        departmentFeatureActive,
        selectedServices,
        addDepartment,
      } = businessProfile;

      if (!name) {
        res.status(400).json({ message: "Missing name in businessProfile" });
        return;
      }

      const {
        userId,
        businessName,
        website,
        registrationNumber,
        city,
        state,
        area,
        addressLine1,
        postalCode,
        latitude,
        longitude,
        phoneNumber,
        country: nameCountry,
      } = name;
      console.log("Parsed business profile:", businessProfile);
      console.log("Parsed parsedPayload:", parsedPayload);
      if (!userId) {
        res.status(400).json({ message: "Missing required userId" });
        return;
      } else {
        // Step 3: Handle Image Upload if Exists
        const imageFile = req.files?.image as any as UploadedFile | UploadedFile[] | undefined;
        const logoKey = imageFile && !Array.isArray(imageFile)
          ? await uploadToS3(imageFile, "logo")
          : undefined;

        // Step 4: Save or Update Profile in MongoDB
        const updatedProfile = await ProfileData.findOneAndUpdate(
          { userId },
          {
            $set: {
              userId,
              businessName,
              website,
              registrationNumber,
              city,
              state,
              area, // Optional area field
              addressLine1,
              postalCode,
              latitude,
              longitude,
              phoneNumber,
              country: nameCountry || country,
              departmentFeatureActive,
              selectedServices,
              addDepartment,
              image: logoKey,
            },
          },
          { new: true, upsert: true }
        );

        if (!updatedProfile) {
          res.status(500).json({ message: "Failed to update profile" });
        } else {
          res.status(200).json({
            message: "Profile updated successfully",
            profile: updatedProfile,
          });
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error("setupProfile error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          message: "Internal Server Error",
          error: error.message,
        });
      }
    }
  },
  deleteDocumentsToUpdate: async (req: Request, res: Response) => {
    const { userId, docId } = req.params;
    console.log("User ID:", userId);
    console.log("Document ID:", docId);
    if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
      return res.status(400).json({ message: "Invalid doctorId format" });
    }

    try {
      const bucket = process.env.AWS_S3_BUCKET_NAME;
      if (!bucket) {
        return res.status(500).json({ message: "S3 bucket not configured" });
      }
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
        (doc: { _id: { toString: () => string } }) => doc._id.toString() === docId
      );

      if (!documentToDelete) {
        return res.status(404).json({ message: "Document not found" });
      }

      const s3Key = documentToDelete.name;
      console.log("S3 Key to delete:", s3Key);

      const deleteParams = {
        Bucket: bucket,
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
      console.log("Fetching hospital profile for userId:", req.query.userId);
      const { userId } = req.query as { userId: string };
      if (typeof userId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(userId)) {
        return res.status(400).json({ message: "Invalid doctorId format" });
      }

      const profile = await ProfileData.findOne({ userId })



      const image = profile?.image ? `${process.env.CLOUD_FRONT_URI}/${profile.image}` : undefined;

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
      const formattedInput = {
        name: {
          userId: profile.userId,
          businessName: profile.businessName,
          phoneNumber: profile.phoneNumber,
          website: profile.website,
          addressLine1: profile.addressLine1,
          city: profile.city,
          state: profile.state,
          area: profile.area, // Optional area field
          postalCode: profile.postalCode,
          latitude: profile.latitude,
          longitude: profile.longitude,
          registrationNumber: profile.registrationNumber,
        },
        country: profile.country,
        departmentFeatureActive: profile.departmentFeatureActive,
        selectedServices: profile.selectedServices,
        addDepartment: profile.addDepartment,
        image // Assuming logo is the image URL
      };

      const fhirBundle = toFHIRBusinessProfile(formattedInput as BusinessProfile);
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
  refreshToken: (req: Request, res: Response): Response => {
    try {
      const refreshToken: string = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ message: "No refresh token provided" });
      }

      // ✅ Verify refresh token
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as {
        userId: string;
        email: string;
        userType: string;
      };

      // ✅ Create new access token
      if (!ACCESS_SECRET) {
        return res.status(500).json({ message: "JWT access secret not configured." });
      }
      const newAccessToken = jwt.sign(
        {
          userId: decoded.userId,
          email: decoded.email,
          userType: decoded.userType,
        },
        ACCESS_SECRET,
        { expiresIn: ACCESS_EXPIRY } as jwt.SignOptions
      );

      // ✅ Set new access token in cookie
      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 1000 * 60 * 15, // 15 minutes
      });

      return res.status(200).json({
        data: {
          userId: decoded.userId,
          email: decoded.email,
          userType: decoded.userType
        }, message: "Access token refreshed"
      });
    } catch (error) {
      console.error("Refresh error:", error);
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }
  }

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
