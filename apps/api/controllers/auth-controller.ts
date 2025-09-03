import dotenv from 'dotenv';
dotenv.config();
import { Request, Response } from 'express';
import AWS from 'aws-sdk';
import validator from 'validator';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import userModel from '../models/appuser-model';
import helpers from "../utils/helpers";
import { IUser } from "@yosemite-crew/types";
import { verifySocialToken } from '../utils/verifySocialToken';
import { getCognitoUserId } from '../middlewares/authMiddleware';
import { toFhirUser } from '@yosemite-crew/fhir';
import AppUser from '../models/appuser-model';

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
    req: Request,
    res: Response
  ): Promise<void> => {
    const body = req.body?.data as string;

    try {
      const {
        email,
        firstName,
        lastName,
        mobilePhone,
        countryCode,
        addressLine1,
        state,
        area,
        city,
        zipcode,
        country,
        dateOfBirth,
        type,
        flag
      } = JSON.parse(body) as { email: string, firstName: string, lastName: string, mobilePhone: string, countryCode: string, addressLine1: string, state?: string, area?: string, city?: string, zipcode?: string, country?: string, dateOfBirth?: Date, type?: string, flag?: string }


      const password = helpers.generatePassword(12);

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
        return
      }
      const secretHash = helpers.getSecretHash(email);

      const params: AWS.CognitoIdentityServiceProvider.SignUpRequest = {
        ClientId: process.env.COGNITO_CLIENT_ID,
        SecretHash: secretHash,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'phone_number', Value: `${countryCode}${mobilePhone}` },
          { Name: 'address', Value: `${addressLine1} ${area} ${state} ${city} ${zipcode} ${country}` },
          { Name: 'name', Value: `${firstName} ${lastName}` },
        ],
      };


      const files = Array.isArray(req?.files?.files) ? req?.files?.files : [req?.files?.files]

      let imageUrls;
      if (req.files && files.length) {
        imageUrls = await helpers.uploadFiles(files);
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
      const dobString = dateOfBirth; // DD/MM/YYYY
      const [day, month, year] = dobString.split("/");
      const dob = new Date(`${year}-${month}-${day}`);

      // const data = await cognito.signUp(params).promise();
      let data;
      if (type === 'email') {
        data = await cognito.signUp(params).promise();
      } else {
        let parReq = { ...params, UserPoolId: process.env.COGNITO_USER_POOL_ID!, }
        data = await cognito.adminCreateUser(parReq).promise();
      }
      const encryptedPassword = encryptPassword(password);

      const result = await userModel.create({
        cognitoId: data.UserSub,
        email: email.toLowerCase(),
        password: [encryptedPassword],
        firstName: firstName,
        lastName: lastName,
        mobilePhone: mobilePhone,
        countryCode: countryCode,
        address: addressLine1,
        state: state,
        area: area,
        city: city,
        zipcode: zipcode,
        profileImage: imageUrls,
        dateOfBirth: typeof dob === 'string' ? dob : '',
        signupType: type,
        flag: flag
      });

      if (type === 'email') {
        res.status(200).json({
          status: 1,
          message: 'User created successfully, please verify your email',
        });
        return
      }
      else {
        await cognito.adminConfirmSignUp({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: email,
        }).promise();

        const passwordData = result.password?.[0];
        if (!passwordData?.encryptedData || !passwordData.iv) {
          res.status(200).json({ status: 0, message: 'Invalid password data' });
          return
        }
        const decryptedPassword = decryptPassword(passwordData.encryptedData, passwordData.iv);

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
        const refreshToken = authData.AuthenticationResult!.RefreshToken!;
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

        const userData = result.toObject() as IUser & { token?: string, refreshToken?: string };
        userData.token = token;
        userData.refreshToken = refreshToken
        delete userData.password;

        res.status(200).json({ message: 'User created successfully!', status: 1, userData: userData })
      }

      return
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(200).json({ status: 0, message });
    }
  },
  confirmSignup: async (req: Request, res: Response): Promise<void> => {
    const { email, confirmationCode } = req.body as { email: string, confirmationCode: string };

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
      const secretHash = helpers.getSecretHash(email);

      await cognito.confirmSignUp({
        ClientId: process.env.COGNITO_CLIENT_ID,
        SecretHash: secretHash,
        Username: email,
        ConfirmationCode: confirmationCode,
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
    const { email } = req.body as { email: string };

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
      const otpExpiry = new Date(Date.now() + 3 * 60 * 1000);

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
          Body: { Text: { Data: `Your OTP is: ${otp}. It is valid for 3 minutes.` } },
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

  deleteUser: async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as { email: string };

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
      if (!process.env.COGNITO_USER_POOL_ID) {
        res.status(500).json({ status: 0, message: 'Cognito User Pool ID missing' });
        return
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
    const { email, otp } = req.body as { email: string, otp: string };

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
      const secretHash = helpers.getSecretHash(email);

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
      const refreshToken = authData.AuthenticationResult!.RefreshToken!;
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


      const userData = result.toObject() as IUser & { token?: string, refreshToken?: string };
      userData.token = token;
      userData.refreshToken = refreshToken;
      delete userData.password;

      res.status(200).json({ status: 1, message: 'User logged in successfully', userdata: userData });
      return
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error during login';
      res.status(200).json({ status: 0, message: 'Error during login', error: message });
    }
  },

  resendConfirmationCode: async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as { email: string };

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
        // expires: new Date(0), // Set expiration to past
      });

      res.clearCookie("refreshToken", {
        httpOnly: true,               // Recommended: prevent JS access
        secure: isProduction,
        sameSite: "strict",
        // expires: new Date(0), // Set expiration to past
      });

      res.status(200).json({ status: 1, message: "Logout successful" });
      return
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error("Error during sign-out:", error);
      res.status(200).json({ status: 0, message: message });
    }
  },
  socialLogin: async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, token } = req.body as { type: string, token: string };


      if (!token) {
        res.status(200).json({ status: 0, message: 'Invalid Token' });
        return
      }
      const allowedTypes = ['google', 'facebook', 'apple'];

      if (!type || typeof type !== 'string' || !allowedTypes.includes(type)) {
        res.status(200).json({ status: 0, message: 'Invalid login type' });
        return;
      }

      const details: { email: string } | null = verifySocialToken(token, type)
      const { email } = details
      if (!details || !email) {
        res.status(200).json({ message: 'User not found', status: 0 })
      }
      const result = await userModel.findOne({ email: email, type: type });



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
      const secretHash = helpers.getSecretHash(email);

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

      const jwt_token = jwt.sign(payload, secret, signOptions);

      const userData = result.toObject() as IUser & { token?: string };
      userData.token = jwt_token;
      delete userData.password;

      res.status(200).json({ status: 1, message: 'User logged in successfully', userdata: userData })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error("Google Login Error:", error);
      if (error instanceof Error)
        res.status(200).json({ message: 0, error: message });
    }
  },
  getProfileDetail: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getCognitoUserId(req)
      if (!userId) {
        res.status(200).json({ status: 0, message: 'User ID is missing.' })
        return
      }

      const profielDetail = await AppUser.findOne({ cognitoId: userId }).lean();
      if (!profielDetail) {
        res.status(200).json({ status: 0, message: 'No profile found with this details' })
        return;
      }
      const entry: unknown = toFhirUser(profielDetail)
      res.status(200).json({ status: 1, message: 'Profle Details fetched successfully!', data: entry });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(200).json({ message: 0, error: message });
    }
  },
  updateProfileDetail: async (req: Request, res: Response): Promise<void> => {
    try {

      const userId = getCognitoUserId(req);
      if (!userId) {
        res.status(200).json({ status: 0, message: 'User ID is missing.' });
        return;
      }

      // File upload handling
      const files = Array.isArray(req?.files?.files)
        ? req?.files?.files
        : req?.files?.files
          ? [req?.files?.files]
          : [];

      let imageUrls;
      if (files.length) {
        imageUrls = await helpers.uploadFiles(files);
      }

      // Same payload as signup
      const {
        email,
        firstName,
        lastName,
        mobilePhone,
        countryCode,
        addressLine1,
        state,
        area,
        city,
        zipcode,
        country,
        dateOfBirth,
      } = JSON.parse(req.body.data) as {
        email: string;
        firstName: string;
        lastName: string;
        mobilePhone: string;
        countryCode: string;
        addressLine1: string;
        state?: string;
        area?: string;
        city?: string;
        zipcode?: string;
        country?: string;
        dateOfBirth?: string; // DD/MM/YYYY
      };

      // Convert DOB (if provided)
      let dob: Date | undefined;
      if (dateOfBirth) {
        const [day, month, year] = dateOfBirth.split('/');
        dob = new Date(`${year}-${month}-${day}`);
      }

      // Build update object
      const updateData: Partial<IUser> = {
        email: email?.trim().toLowerCase(),
        firstName,
        lastName,
        mobilePhone,
        countryCode,
        address: addressLine1,
        state,
        area,
        city,
        zipcode,
        country,
        dateOfBirth: dob,
      };

      // if(updateData.email){
      //   res.status(200).json({message:'Email cannot be update', status:0})
      //   return
      // }
      delete updateData.email;
      // Remove undefined fields
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      // Attach uploaded image(s)
      if (imageUrls && imageUrls.length) {
        updateData.profileImage = imageUrls;
      }

      const profileDetail = await AppUser.findOneAndUpdate(
        { cognitoId: userId },
        { $set: updateData },
        { new: true }
      );

      if (!profileDetail) {
        res.status(200).json({ status: 0, message: 'User not found' });
        return;
      }

      res.status(200).json({
        status: 1,
        message: 'Profile detail updated successfully',
        data: profileDetail,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An error occurred';
      res.status(200).json({ status: 0, message });
    }
  },
  deleteUserAccountUsingToken: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getCognitoUserId(req)
      if (!userId) {
        res.status(200).json({ message: 'User id required', status: 0 })
        return
      }

      const user = await AppUser.findOne({ cognitoId: userId })
      if (!user) {
        res.status(200).json({ message: 'Account not deleted', status: 0 })
        return
      }

      if (!process.env.COGNITO_USER_POOL_ID) {
        res.status(500).json({ status: 0, message: 'Cognito User Pool ID missing' });
        return
      }
      await cognito.adminDeleteUser({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: user.email!,
      }).promise();
      await AppUser.deleteOne({ cognitoId: userId })

      res.status(200).json({ message: 'Account deleted successfully', status: 1 })

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An internal server occurred'
      res.status(200).json({ message: message, status: 0 })
    }
  },
  refreshToken: async (req: Request, res: Response): Promise<void> => {
    try {
      // const userID = getCognitoUserId(req);

      const { refreshToken, userID } = req.body as { refreshToken: string, userID:string };
      if (!refreshToken) {
        res.status(200).json({ status: 0, message: 'Refresh token required' })
      }

      const secretHash = helpers.getSecretHash(userID);
      const params = {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: process.env.COGNITO_CLIENT_ID!,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          SECRET_HASH: secretHash,
          USERNAME: userID
        }
      };

      const response = await cognito.initiateAuth(params).promise();

      const accessToken = response.AuthenticationResult!.AccessToken!;
      const decoded = jwt.decode(accessToken) as { sub: string };
      console.log(decoded,'decoded');

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


      res.status(200).json({
        accessToken: token,
        message: "Access token refreshed",
        status: 1
      });
      return
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An internal server error occurred'
      res.status(200).json({ error: message });
    }
  },

  withdrawRequestForm: async (req: Request<unknown, unknown, { data?: string }>, res: Response): Promise<void> => {
    try {
      const userID = getCognitoUserId(req);

      const data = req.body?.data as string;

      const { email } = JSON.parse(data) as { email: string }
      if(!email){
        res.status(200).json({message:'Email is required', status:0})
        return
      }
      const params = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: userID,
      };

      const response = await cognito.adminDeleteUser(params).promise();

      await AppUser.findByIdAndDelete({ email: email })
      res.status(200).json({ status: 1, message: "form submitted successfully!", response })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An internal server occurred!'
      res.status(200).json({ error: message, status: 0 })
    }
  }

};

export default authController;
