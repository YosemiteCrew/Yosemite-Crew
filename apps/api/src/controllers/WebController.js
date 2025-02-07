const AWS = require('aws-sdk');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { WebUser, ProfileData } = require('../models/WebUser');
const path = require('path');

const secretKey = process.env.ENCRYPTION_KEY;
const SES = new AWS.SES();
const cognito = new AWS.CognitoIdentityServiceProvider();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

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
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required.' });
      }

      const confirmParams = {
        ClientId: process.env.COGNITO_CLIENT_ID_WEB,
        Username: email,
        ConfirmationCode: otp, // OTP received from the user
      };

      if (process.env.COGNITO_CLIENT_SECRET) {
        confirmParams.SecretHash = getSecretHash(email);
      }

      // Verify OTP
      await cognito.confirmForgotPassword(confirmParams).promise();
      res.status(200).json({
        message: 'OTP verified successfully. You can now reset your password.',
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      res
        .status(500)
        .json({ message: 'Error verifying OTP.', error: error.message });
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
    console.log('Files:', req.files?.prescription_upload);
    try {
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
        activeModes,
        selectedServices,
      } = req.body;
      console.log('selectedServices', selectedServices);
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

      const logo = req.files?.logo
        ? await uploadToS3(req.files.logo, 'logo')
        : undefined; // Don't overwrite if no new logo is provided
      const prescriptionUpload = req.files?.prescription_upload
        ? await uploadToS3(req.files.prescription_upload, 'prescriptions')
        : undefined; // Don't overwrite if no new prescription file is provided

      const profile = await ProfileData.findOne({ userId });

      if (profile) {
        await ProfileData.updateOne(
          { userId },
          {
            $set: {
              businessName,
              registrationNumber,
              yearOfEstablishment,
              phoneNumber,
              website,
              address: { addressLine1, street, city, state, zipCode },
              activeModes,
              selectedServices,
              logo: logo || profile.logo,
              prescription_upload:
                prescriptionUpload || profile.prescription_upload,
            },
          }
        );
        res.status(200).json({ message: 'Profile updated successfully' });
      } else {
        // Create a new profile if it doesn't exist
        const newProfile = await ProfileData.create({
          userId,
          businessName,
          registrationNumber,
          yearOfEstablishment,
          phoneNumber,
          website,
          address: { addressLine1, street, city, state, zipCode },
          activeModes,
          selectedServices,
          logo: logo || null,
          prescription_upload: prescriptionUpload || null,
        });
        if (newProfile) {
          res.status(200).json({ message: 'Profile created successfully' });
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error.message, error.stack);
      res.status(500).json({
        message: 'Error updating profile',
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
        const prescriptionUploadUrl = getS3Url(profile.prescription_upload);
        console.log(logoUrl, prescriptionUploadUrl);

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
