const AWS = require('aws-sdk');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { WebUser, ProfileData } = require('../models/WebUser');
import {
  ConfirmForgotPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
const cognitoo = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

const cognito = new AWS.CognitoIdentityServiceProvider();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const WebController = {
  Register: async (req, res) => {
    try {
      const { email, password, businessType } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Email and password are required.' });
      }

      console.log('Checking if user exists in Cognito...');

      // Check if user exists in Cognito
      try {
        const params = {
          UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB,
          Username: email,
        };
        const userData = await cognito.adminGetUser(params).promise();

        console.log('User found in Cognito:', userData);

        // Check if email is verified
        const emailVerified =
          userData.UserAttributes.find((attr) => attr.Name === 'email_verified')
            ?.Value === 'true';

        console.log('Email verified status:', emailVerified);

        if (emailVerified) {
          return res
            .status(409)
            .json({ message: 'User already exists. Please login.' });
        }

        // If user exists but is NOT verified, resend OTP
        console.log('User exists but is not verified. Resending OTP...');
        const resendParams = {
          ClientId: process.env.COGNITO_CLIENT_ID_WEB,
          Username: email,
        };

        if (process.env.COGNITO_CLIENT_SECRET) {
          resendParams.SecretHash = getSecretHash(email);
        }

        await cognito.resendConfirmationCode(resendParams).promise();

        return res.status(200).json({ message: 'New OTP sent to your email.' });
      } catch (err) {
        if (err.code !== 'UserNotFoundException') {
          console.error('Error checking Cognito user:', err);
          return res
            .status(500)
            .json({ message: 'Error checking user status.' });
        }
      }

      // If user is not found, proceed with registration
      console.log('User not found. Proceeding with registration...');

      const signUpParams = {
        ClientId: process.env.COGNITO_CLIENT_ID_WEB,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      };

      if (process.env.COGNITO_CLIENT_SECRET) {
        signUpParams.SecretHash = getSecretHash(email);
      }

      let data;
      try {
        data = await cognito.signUp(signUpParams).promise();
        console.log('User successfully registered in Cognito:', data);
      } catch (err) {
        if (err.code === 'UsernameExistsException') {
          return res.status(409).json({
            message:
              'User already exists in Cognito. Please verify your email.',
          });
        }
        console.error('Cognito Signup Error:', err);
        return res
          .status(500)
          .json({ message: 'Error registering user. Please try again later.' });
      }

      // Save only CognitoId and BusinessType in MongoDB
      const newUser = new WebUser({
        cognitoId: data.UserSub,
        businessType,
      });

      await newUser.save();

      return res.status(200).json({
        message:
          'User registered successfully! Please verify your email with OTP.',
      });
    } catch (error) {
      console.error('Unexpected Error:', error);
      return res
        .status(500)
        .json({ message: 'Internal Server Error. Please try again later.' });
    }
  },

  verifyUser: async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required.' });
      }

      console.log('Verifying OTP for email:', email);

      const secretHash = getSecretHash(email);

      // Retrieve Cognito user details to check if the user is already confirmed
      const params = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB,
        Username: email,
      };

      let cognitoId;
      let isUserVerified = false;

      try {
        const userData = await cognito.adminGetUser(params).promise();
        console.log('Cognito User Data:', JSON.stringify(userData, null, 2));

        // Check if user is already verified
        const emailVerified =
          userData?.UserAttributes?.find(
            (attr) => attr.Name === 'email_verified'
          )?.Value === 'true';

        if (emailVerified) {
          isUserVerified = true;
        }

        // Extract Cognito ID (sub)
        cognitoId = userData?.UserAttributes?.find(
          (attr) => attr.Name === 'sub'
        )?.Value;

        if (!cognitoId) {
          console.error('Cognito ID (sub) not found:', userData.UserAttributes);
          return res.status(500).json({ message: 'Cognito ID not found.' });
        }

        console.log('Cognito ID:', cognitoId);
      } catch (err) {
        console.error('Error retrieving Cognito user:', err);
        return res
          .status(500)
          .json({ message: 'Error retrieving user details.' });
      }

      // If the user is not verified yet, proceed with OTP confirmation
      if (!isUserVerified) {
        // Confirm user signup with OTP in Cognito
        const confirmParams = {
          ClientId: process.env.COGNITO_CLIENT_ID_WEB,
          SecretHash: secretHash,
          Username: email,
          ConfirmationCode: String(otp),
        };

        try {
          await cognito.confirmSignUp(confirmParams).promise();
          console.log('User confirmed with OTP');
        } catch (err) {
          console.error('Cognito Verification Error:', err);
          return res.status(400).json({
            message: 'Invalid OTP or user already verified.',
          });
        }
      }

      // Find the user in MongoDB using cognitoId
      const user = await WebUser.findOne({ cognitoId });

      if (!user) {
        return res
          .status(404)
          .json({ message: 'User not found in the system' });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: cognitoId,
          email,
          userType: user.businessType,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.EXPIRE_IN }
      );

      return res.status(200).json({
        message: 'User verified successfully!',
        token,
        cognitoId,
      });
    } catch (error) {
      console.error('Unexpected Error:', error);
      return res
        .status(500)
        .json({ message: 'Internal Server Error. Please try again later.' });
    }
  },

  signIn: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Email and password are required' });
      }

      const secretHash = getSecretHash(email);

      const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.COGNITO_CLIENT_ID_WEB,
        AuthParameters: {
          SECRET_HASH: secretHash,
          USERNAME: email,
          PASSWORD: password,
        },
      };

      // Authenticate user with Cognito
      const data = await cognito.initiateAuth(params).promise();

      if (!data.AuthenticationResult) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Get user details from Cognito to extract cognitoId (sub)
      const userDetails = await cognito
        .adminGetUser({
          UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB,
          Username: email,
        })
        .promise();

      const cognitoId = userDetails.UserAttributes.find(
        (attr) => attr.Name === 'sub'
      )?.Value;

      if (!cognitoId) {
        return res
          .status(500)
          .json({ message: 'Failed to retrieve Cognito ID' });
      }

      // Find user in MongoDB using cognitoId
      const user = await WebUser.findOne({ cognitoId });

      if (!user) {
        return res
          .status(404)
          .json({ message: 'User not found in the system' });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: cognitoId,
          email,
          userType: user.businessType,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.EXPIRE_IN }
      );

      return res.json({
        token,
        message: 'Logged in successfully',
      });
    } catch (error) {
      console.error('Error during sign-in:', error);

      if (error.code === 'NotAuthorizedException') {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      return res.status(500).json({ message: 'Internal server error', error });
    }
  },

  signOut: async (req, res) => {
    try {
      res.clearCookie('accessToken', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
      });

      res.clearCookie('refreshToken', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
      });

      return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Error during sign-out:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      console.log(email);

      // Check if user exists in Cognito
      const params = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID_WEB,
        Username: email,
      };

      try {
        await cognito.adminGetUser(params).promise(); // Ensure user exists
      } catch (err) {
        if (err.code === 'UserNotFoundException') {
          return res.status(404).json({ message: 'User not found in Cognito' });
        }
        console.error('Error checking user in Cognito:', err);
        return res
          .status(500)
          .json({ message: 'Error checking user status in Cognito.' });
      }

      // Send a password reset code to the user using Cognito's forgotPassword API
      const resetParams = {
        ClientId: process.env.COGNITO_CLIENT_ID_WEB,
        Username: email,
      };

      if (process.env.COGNITO_CLIENT_SECRET_WEB) {
        resetParams.SecretHash = getSecretHash(email);
      }

      await cognito.forgotPassword(resetParams).promise();

      // Success
      return res.status(200).json({
        message:
          'Password reset code sent to your email. Please check your inbox.',
      });
    } catch (error) {
      console.error('Error during forgotPassword:', error);
      return res.status(500).json({
        message: 'Error during password reset process',
        error: error.message,
      });
    }
  },

  verifyOtp: async (req, res) => {
    try {
      const { email, otp, password: newPassword } = req.body;

      if (!email || !otp || !newPassword) {
        return res
          .status(400)
          .json({ message: 'Email, OTP, and new password are required.' });
      }

      const params = {
        ClientId: process.env.COGNITO_CLIENT_ID_WEB,
        Username: email,
        SecretHash: getSecretHash(email),
        ConfirmationCode: String(otp).trim(), // Ensure OTP is a string
        Password: newPassword,
      };

      await cognitoo.send(new ConfirmForgotPasswordCommand(params));

      res
        .status(200)
        .json({ message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
      console.error('Error resetting password:', error);
      res
        .status(500)
        .json({ message: 'Error resetting password.', error: error.message });
    }
  },
  updatePassword: async (req, res) => {
    try {
      const { email, password } = req.body;
      const getdata = await WebUser.findOne({ email });
      if (!getdata) {
        return res.status(404).json({ message: 'User not found' });
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        await WebUser.updateOne(
          { email },
          { $set: { password: hashedPassword } }
        );
        res.status(200).json({ message: 'Password updated successfully' });
      }
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({
        message: 'Error updating password',
      });
    }
  },
  setupProfile: async (req, res) => {
    try {
      console.log('Received Files:', req.files);

      const {
        userId,
        businessName,
        registrationNumber,
        yearOfEstablishment,
        phoneNumber,
        website,
        addressLine1,
        street,
        city,
        state,
        zipCode,
        latitude,
        longitude,
        activeModes,
        selectedServices,
      } = req.body;

      // Function to upload files to S3
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
              console.error('Error uploading to S3:', err);
              reject(err);
            } else {
              resolve(data.Key);
            }
          });
        });
      };

      let prescriptionUpload = [];

      // Upload logo if provided
      const logo = req.files?.logo
        ? await uploadToS3(req.files.logo, 'logo')
        : undefined;

      // Check and process multiple prescription_upload files
      if (req.files && req.files.prescription_upload) {
        const documentFiles = Array.isArray(req.files.prescription_upload)
          ? req.files.prescription_upload
          : [req.files.prescription_upload]; // Convert to array if single file

        for (let file of documentFiles) {
          const documentKey = await uploadToS3(file, 'prescription_upload');
          console.log('Uploaded Document Key:', documentKey);
          prescriptionUpload.push({
            name: documentKey,
            type: file.mimetype,
            date: new Date(),
          });
        }
      }

      // Update Profile in Database
      const updatedProfile = await ProfileData.findOneAndUpdate(
        { userId },
        {
          $set: {
            businessName,
            registrationNumber,
            yearOfEstablishment,
            phoneNumber,
            website,
            address: { addressLine1, street, city, state, zipCode,latitude, longitude },
            activeModes,
            selectedServices,
            logo: logo || undefined, // Keep existing logo if not updated
          },
          $push: {
            prescription_upload: { $each: prescriptionUpload }, // Append new files
          },
        },
        { new: true, upsert: true }
      );

      if (updatedProfile) {
        return res.status(200).json({
          message: 'Profile updated successfully',
          profile: updatedProfile,
        });
      }

      res.status(400).json({ message: 'Profile update failed' });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error.message,
      });
    }
  },

  getProfile: async (req, res) => {
    try {
      const userId = req.params.id;
      const profile = await ProfileData.findOne({ userId });

      if (profile) {
        const getS3Url = (fileKey) => {
          if (fileKey) {
            return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${fileKey}`;
          }
          return null;
        };

        const logoUrl = getS3Url(profile.logo);
        console.log('profile.prescription_upload', profile.prescription_upload);
        const prescriptionUploadUrl = profile.prescription_upload.map(
          (file) => ({
            name: getS3Url(file.name),
            type: file.type,
            date: file.date,
            _id: file._id,
          })
        ); // Convert prescription upload to desired format

        res.status(200).json({
          ...profile.toObject(),
          logoUrl,
          prescriptionUploadUrl,
        });
      } else {
        res.status(404).json({ message: 'Profile not found' });
      }
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({ message: 'Error retrieving profile' });
    }
  },
  deleteDocumentsToUpdate: async (req, res) => {
    const { userId, docId } = req.params;
    console.log('User ID:', userId);
    console.log('Document ID:', docId);

    try {
      const user = await ProfileData.findOne({ userId }).lean();

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.prescription_upload || user.prescription_upload.length === 0) {
        return res
          .status(404)
          .json({ message: 'No documents found for this user' });
      }

      const documentToDelete = user.prescription_upload.find(
        (doc) => doc._id.toString() === docId
      );

      if (!documentToDelete) {
        return res.status(404).json({ message: 'Document not found' });
      }

      const s3Key = documentToDelete.name;
      console.log('S3 Key to delete:', s3Key);

      const deleteParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
      };

      try {
        const headObject = await s3.headObject(deleteParams).promise();
        console.log('S3 File Found:', headObject);
      } catch (headErr) {
        console.error('S3 File Not Found:', headErr);
        return res.status(404).json({ message: 'File not found in S3' });
      }

      try {
        const deleteResponse = await s3.deleteObject(deleteParams).promise();
        console.log('S3 Delete Response:', deleteResponse);
      } catch (deleteErr) {
        console.error('S3 Deletion Error:', deleteErr);
        return res
          .status(500)
          .json({ message: 'Failed to delete file from S3', error: deleteErr });
      }

      const updatedUser = await ProfileData.findOneAndUpdate(
        { userId },
        { $pull: { prescription_upload: { _id: docId } } },
        { new: true }
      );

      if (!updatedUser) {
        return res
          .status(404)
          .json({ message: 'Document not found in the database' });
      }

      console.log('Document deleted successfully from both database and S3');
      res.status(200).json({
        message: 'Document deleted successfully from both database and S3',
        updatedUser,
      });
    } catch (err) {
      console.error('Unexpected Error:', err);
      res.status(500).json({
        message: 'An error occurred while deleting the document',
        error: err,
      });
    }
  },
  getLocationdata: async (req, res) => {
   
      try {
          const placeId = req.query.placeid;
          const apiKey = 'AIzaSyBKuPqcVG84Pwqvb_nnPp5sYbs-mby9SuI'
          const url = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=${apiKey}`;
  
          const response = await axios
          .get(url);
          const extractAddressDetails = (geoLocationResp) => {
            const addressResp = {
              address: '',
              street: '',
              city: '',
              state: '',
              zipCode: '',
              country: '',
              lat: geoLocationResp.geometry.location.lat,
              long: geoLocationResp.geometry.location.lng,
            };
        
            const address_components = geoLocationResp.address_components || [];
        
            address_components.forEach((component) => {
              const types = component.types;
        
              if (types.includes('route')) {
                addressResp.street = component.long_name;
              }
              if (types.includes('locality')) {
                addressResp.city = component.long_name;
              }
              if (types.includes('administrative_area_level_1')) {
                addressResp.state = component.short_name;
              }
              if (types.includes('postal_code')) {
                addressResp.zipCode = component.long_name;
              }
              if (types.includes('country')) {
                addressResp.country = component.long_name;
              }
            });
        
            return addressResp;
          };
const data = extractAddressDetails(
  response.data.result
)
          res.json(data) 
      } catch (error) {
          res.status(500).json({ error: error.message });
      }
  }
  
};
function getSecretHash(email) {
  const clientId = process.env.COGNITO_CLIENT_ID_WEB;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET_WEB;

  return crypto
    .createHmac('SHA256', clientSecret)
    .update(email + clientId)
    .digest('base64');
}

module.exports = WebController;
