import dotenv from 'dotenv';
dotenv.config();
import { Request, Response } from 'express';
import AWS from 'aws-sdk';
import validator from 'validator';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import userModel from '../models/appuser-model';
import helpers from "../utils/helpers";
import { IUser, SignupRequestBody } from "@yosemite-crew/types";

const region = process.env.AWS_REGION!;
const SES = new AWS.SES({ region });
const cognito = new AWS.CognitoIdentityServiceProvider({ region });

const algorithm = 'aes-256-cbc';
const secretKey = crypto.createHash('sha256')
  .update(process.env.ENCRYPTION_KEY || '')
  .digest();

interface IEncryptedPassword {
  encryptedData: string;
  iv: string;
}

// Helper: Secret hash for Cognito
function getSecretHash(username: string): string {
  const clientId = process.env.COGNITO_CLIENT_ID!;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET!;
  return crypto.createHmac('SHA256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}

// Helper: Password generator
function generatePassword(length: number): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?";
  const password: string[] = [];
  while (password.length < length) {
    const value = crypto.randomBytes(1)[0];
    if (value < Math.floor(256 / charset.length) * charset.length) {
      password.push(charset[value % charset.length]);
    }
  }
  return password.join('');
}

// Encrypt password
function encryptPassword(password: string): IEncryptedPassword {
  const iv = crypto.randomBytes(16); // generate per password
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  let encrypted = cipher.update(password, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return { encryptedData: encrypted, iv: iv.toString('hex') };
}

// Decrypt password
function decryptPassword(encryptedData: string, ivHex: string): string {
  const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(ivHex, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

const authController = {
  signUp: async (
    req: Request<Record<string, never>, unknown, SignupRequestBody>,
    res: Response
  ): Promise<void> => {
    const body: SignupRequestBody = req.body;
    try {
      const {
        email,
        firstName,
        lastName,
        mobilePhone,
        countryCode,
        address,
        state,
        area,
        city,
        zipcode,
        // professionType,
        // pimsCode,
        dateOfBirth
      } = body.data;

      const password = generatePassword(12);



      // const isProfessional =
      //   Array.isArray(professionType) && professionType.length > 0 ? 'yes' : 'no';
      // const parsedProfessionType: string[] =
      //   typeof professionType === 'string'
      //     ? (JSON.parse(professionType.replace(/^'|'$/g, '')) as string[])
      //     : professionType;

      if (!process.env.COGNITO_CLIENT_ID || !process.env.COGNITO_CLIENT_SECRET) {
        res.status(200).json({ status: 0, message: 'Cognito configuration missing' });
        return;
      }
      if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
        res.status(200).json({ status: 0, message: 'Invalid email address' });
      }
      const secretHash = getSecretHash(email);

      const params: AWS.CognitoIdentityServiceProvider.SignUpRequest = {
        ClientId: process.env.COGNITO_CLIENT_ID,
        SecretHash: secretHash,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'phone_number', Value: `${countryCode}${mobilePhone}` },
          { Name: 'address', Value: `${address} ${area} ${state} ${city} ${zipcode}` },
          { Name: 'name', Value: `${firstName} ${lastName}` },
        ],
      };

      let imageUrls: string[] = [];

      const uploadedFiles = req.files as { files: Express.Multer.File | Express.Multer.File[] } | undefined;

      if (uploadedFiles?.files) {
        const files = Array.isArray(uploadedFiles.files)
          ? uploadedFiles.files
          : [uploadedFiles.files];

        const images = files.filter(file => file.mimetype?.startsWith('image/'));

        if (images.length > 0) {
          // Map Express.Multer.File[] to UploadedFile[]
          const uploadedFilesForHelper = images.map(file => ({
            name: file.originalname,
            data: file.buffer,
            mimetype: file.mimetype,
            size: file.size,
          }));
          const uploaded = await helpers.uploadFiles(uploadedFilesForHelper);
          imageUrls = uploaded.map(file => file.url);
        }
      }
      if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
        res.status(200).json({ status: 0, message: 'Invalid email address' });
        return
      }
      const safeEmail = email.trim().toLowerCase();
      const existingUser = await userModel.findOne({ email: safeEmail });
      if (existingUser) {
        const userData = existingUser.toObject() as IUser;
        delete userData.password;
        res.status(200).json({ status: 0, message: 'Email already exists', data: userData });
        return;
      }

      const data = await cognito.signUp(params).promise();
      const encryptedPassword = encryptPassword(password);

      await userModel.create({
        cognitoId: data.UserSub,
        email,
        password: [encryptedPassword],
        firstName,
        lastName,
        mobilePhone,
        countryCode,
        address,
        state,
        area,
        city,
        zipcode,
        profileImage: imageUrls,
        dateOfBirth: typeof dateOfBirth === 'string' ? dateOfBirth : '',
      });

      res.status(200).json({
        status: 1,
        message: 'User created successfully, please verify your email',
      });
      return
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(200).json({ status: 0, message });
    }
  },

  confirmSignup: async (req: Request, res: Response): Promise<void> => {
    const { data:{ email, confirmationCode } } = req.body as SignupRequestBody;

    try {

      if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
        res.status(200).json({ status: 0, message: 'Invalid email address' });
      }

      const safeEmail = email.trim().toLowerCase();

      const result = await userModel.findOne({ email: safeEmail });

      if (!result) {
        res.status(200).json({ status: 0, message: 'User not found' });
        return
      }

      const passwordData = result.password?.[0];
      if (!passwordData?.encryptedData || !passwordData.iv) {
        res.status(200).json({ status: 0, message: 'Invalid password data' });
        return
      }

      const decryptedPassword = decryptPassword(passwordData.encryptedData, passwordData.iv);

      if (!process.env.COGNITO_CLIENT_ID) {
        res.status(200).json({ status: 0, message: 'Cognito configuration missing' });
        return
      }
      const secretHash = getSecretHash(email);

      await cognito.confirmSignUp({
        ClientId: process.env.COGNITO_CLIENT_ID,
        SecretHash: secretHash,
        Username: email,
        ConfirmationCode: confirmationCode!,
      }).promise();

      const authData = await cognito.initiateAuth({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: decryptedPassword,
          SECRET_HASH: secretHash,
        },
      }).promise();

      const accessToken = authData.AuthenticationResult!.AccessToken!;
      const decoded = jwt.decode(accessToken) as { sub: string };

      const payload = {
        username: decoded.sub,
        accessToken,
      };

      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET is not defined');

      const expiresInEnv = parseInt(process.env.JWT_EXPIRE_TIME ?? '3600', 10); // seconds

      const signOptions: SignOptions = {
        expiresIn: expiresInEnv,
      };

      const token = jwt.sign(payload, secret, signOptions);

      const userData = result.toObject() as IUser & { token?: string };
      userData.token = token;
      delete userData.password;

      await userModel.updateOne({ _id: result._id }, { $set: { isConfirmed: true } });

      res.status(200).json({
        status: 1,
        message: 'User confirmed successfully',
        userdata: userData,
      });
      return
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(200).json({ status: 0, message: 'Error during confirmation', error: message });
      return
    }
  },

  sendOtp: async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as SignupRequestBody;

    try {
      if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
        res.status(200).json({ status: 0, message: 'Invalid email address' });
        return
      }

      const safeEmail = email.trim().toLowerCase();

      const result = await userModel.findOne({ email: safeEmail });

      if (!result) {
        res.status(200).json({ status: 0, message: 'User not found' });
        return
      }

      const otp = Math.floor(100000 + Math.random() * 900000);
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

      await userModel.updateOne({ email: safeEmail }, { $set: { otp, otpExpiry } });

      if (!process.env.MAIL_DRIVER) {
        res.status(500).json({ status: 0, message: 'MAIL_DRIVER not configured' });
        return
      }

      await SES.sendEmail({
        Source: process.env.MAIL_DRIVER,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: 'Your OTP Code' },
          Body: { Text: { Data: `Your OTP is: ${otp}. It is valid for 5 minutes.` } },
        },
      }).promise();

      res.status(200).json({ status: 1, message: 'OTP sent successfully' });
      return
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error during Sending OTP';
      res.status(200).json({ status: 0, message, error: message });
      return
    }
  },

  deleteUser: async (req: Request, res: Response) => {
    const { email } = req.body as SignupRequestBody;

    try {
      if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
        res.status(200).json({ status: 0, message: 'Invalid email address' });
      }

      const safeEmail = email.trim().toLowerCase();

      const result = await userModel.findOne({ email: safeEmail });

      if (!result) {
        res.status(200).json({ status: 0, message: 'User not found' });
        return
      }
      if (!process.env.COGNITO_USER_POOL_ID) {
        return res.status(500).json({ status: 0, message: 'Cognito User Pool ID missing' });
      }
      await cognito.adminDeleteUser({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: email,
      }).promise();

      await userModel.deleteOne({ email: safeEmail });
      res.status(200).json({ status: 1, message: 'User deleted successfully' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(200).json({ status: 0, message: 'Error while deleting user', error: message });
    }
  },

  login: async (req: Request, res: Response): Promise<void> => {
    const { email, otp } = req.body as SignupRequestBody;

    try {
      if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
        res.status(200).json({ status: 0, message: 'Invalid email address' });
        return
      }
      const safeEmail = email.trim().toLowerCase();

      const result = await userModel.findOne({ email: safeEmail });

      if (!result) {
        res.status(200).json({ status: 0, message: 'User not found' });
        return
      }

      // Check OTP and expiry
      if (
        !otp ||
        result.otp !== parseInt(otp) ||
        (result.otpExpiry && Date.now() > new Date(result.otpExpiry).getTime())
      ) {
        res.status(200).json({
          status: 0,
          message:
            result.otpExpiry && Date.now() > new Date(result.otpExpiry).getTime()
              ? 'OTP has expired.'
              : 'Invalid OTP.',
        });
        return
      }

      const passwordData = result.password?.[0];
      if (!passwordData?.encryptedData || !passwordData.iv) {
        res.status(200).json({ status: 0, message: 'Invalid password data' });
        return
      }

      const decryptedPassword = decryptPassword(passwordData.encryptedData, passwordData.iv);

      if (!process.env.COGNITO_CLIENT_ID) {
        res.status(200).json({ status: 0, message: 'Cognito configuration missing' });
        return
      }
      const secretHash = getSecretHash(email);

      const authData = await cognito.initiateAuth({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: decryptedPassword,
          SECRET_HASH: secretHash,
        },
      }).promise();

      const accessToken = authData.AuthenticationResult!.AccessToken!;
      const decoded = jwt.decode(accessToken) as { sub: string };

     
      const payload = {
        username: decoded.sub,
        accessToken,
      };

      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET is not defined');

      const expiresInEnv = parseInt(process.env.JWT_EXPIRE_TIME ?? '3600', 10); // seconds   
      const signOptions: SignOptions = {
        expiresIn: expiresInEnv,
      };

      const token = jwt.sign(payload, secret, signOptions);

      const userData = result.toObject() as IUser & { token?: string };
      userData.token = token;
      delete userData.password;

      res.status(200).json({ status: 1, message: 'User logged in successfully', userdata: userData });
      return
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error during login';
      res.status(200).json({ status: 0, message: 'Error during login', error: message });
    }
  },

  resendConfirmationCode: async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as SignupRequestBody;

    try {
      if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
        res.status(200).json({ status: 0, message: 'Invalid email address' });
        return
      }

      if (!process.env.COGNITO_CLIENT_ID) {
        res.status(500).json({ status: 0, message: 'Cognito configuration missing' });
        return
      }
      const secretHash = getSecretHash(email);

      await cognito.resendConfirmationCode({
        ClientId: process.env.COGNITO_CLIENT_ID,
        SecretHash: secretHash,
        Username: email,
      }).promise();

      res.status(200).json({ status: 1, message: 'Confirmation code resent successfully' });
      return
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(200).json({ status: 0, message: 'Error resending confirmation code', error: message });
      return
    }
  },
  logout: (req: Request, res: Response): void => {

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
      return
    } catch (error) {
      console.error("Error during sign-out:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

export default authController;
