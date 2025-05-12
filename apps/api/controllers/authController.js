const AWS = require("aws-sdk");
const validator = require('validator');
const crypto = require("crypto");
const user = require("../models/YoshUser");
const path = require("path");
const jwt = require("jsonwebtoken");
const algorithm = "aes-256-cbc"; // Algorithm
const secretKey = crypto.createHash('sha256')
  .update(process.env.ENCRYPTION_KEY)
  .digest();
const iv = crypto.randomBytes(16); // Initialization vector
const SES = new AWS.SES();
const helpers = require('../utils/helpers');

// Initialize AWS Cognito Identity Provider
const cognito = new AWS.CognitoIdentityServiceProvider();

// Controller for handling authentication
const authController = {
  // Signup API
  signup: async (req, res) => {
    var fileName = "";
    const password = generatePassword(12);
    const {
      email,
      firstName,
      lastName,
      mobilePhone,
      countryCode,
      city,
      zipcode,
      professionType,
      pimsCode,
    } = req.body;

    if (typeof email !== 'string' || !validator.isEmail(email)) {
      return res.status(200).json({ status: 0, message: "Invalid email format" });
    }
    if (Array.isArray(professionType)) {
      isProfessional = professionType.length === 0 ? "no" : "yes";
    } else {
      isProfessional = "no"; // Default to 'no' if it's not an array
    }
    let parsedDataprofessionType;
    let cleanedProfessionType = professionType;
    if (cleanedProfessionType.startsWith("'") && cleanedProfessionType.endsWith("'")) {
      cleanedProfessionType = cleanedProfessionType.slice(1, -1);
    }
    parsedDataprofessionType = JSON.parse(cleanedProfessionType);
   
    // Calculate the SECRET_HASH using the getSecretHash function
    const secretHash = getSecretHash(email);

    const params = {
      ClientId: process.env.COGNITO_CLIENT_ID,
      SecretHash: secretHash, // Include the calculated SECRET_HASH
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email }, // Add email as a user attribute
        { Name: "phone_number", Value: `${countryCode}${mobilePhone}` },
        { Name: "address", Value: city },
        { Name: "name", Value: `${firstName} ${lastName}` },
      ],
    };
    try {
      let imageUrls = '';

      if (req.files && req.files.files) {
        const files = Array.isArray(req.files.files)
          ? req.files.files
          : [req.files.files]; // wrap single file into array

        const imageFiles = files.filter(file => file.mimetype && file.mimetype.startsWith("image/"));

        if (imageFiles.length > 0) {
          imageUrls = await helpers.uploadFiles(imageFiles);
        }
      }
      
     // console.log(password);
      const encrypt_Password = await encryptPassword(password);
      const result = await user.findOne({ email });
     
      if (result) {
        const userData = result.toObject();
        delete userData.password;
        return res.status(200).json({ message: "Email already exists", data: userData });
      }
      const data = await cognito.signUp(params).promise();
      const adduser = await user.create({
        cognitoId: data.UserSub,
        email,
        password: encrypt_Password,
        firstName,
        lastName,
        mobilePhone,
        city,
        zipcode,
        isProfessional,
        professionType:parsedDataprofessionType,
        pimsCode,
        profileImage: imageUrls,
      });
      res.status(200).json({
        status: 1,
        message: "User created successfully, please verify your email",
      });
    } catch (error) {
      res.status(200).json({
        status: 0,
        // message: "Error while sign up",
        message: error.message,
      });
    }
  },

  confirmSignup: async (req, res) => {
    const { email, confirmationCode } = req.body;
  
    try {
      if (typeof email !== 'string' || !validator.isEmail(email)) {
        return res.status(400).json({ status: 0, message: "Invalid email format" });
      }
      // Step 1: Find the user in the database
      const result = await user.findOne({ email });
      if (!result) {
        return res.status(404).json({ status: 0, message: "User not found" });
      }
  
      // Step 2: Decrypt the user's password
      const [{ encryptedData, iv }] = result.password;
      const decryptedPassword = decryptPassword(encryptedData, iv);
  
      // Step 3: Confirm the user's signup with Cognito
      const secretHash = getSecretHash(email);
      const confirmParams = {
        ClientId: process.env.COGNITO_CLIENT_ID,
        SecretHash: secretHash,
        Username: email,
        ConfirmationCode: confirmationCode,
      };
  
      await cognito.confirmSignUp(confirmParams).promise();
  
      // Step 4: Authenticate the user with Cognito
      const authParams = {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: decryptedPassword,
          SECRET_HASH: secretHash,
        },
      };
      
      const authData = await cognito.initiateAuth(authParams).promise();
      const accessToken = authData.AuthenticationResult.AccessToken;
      const decodedToken = jwt.decode(accessToken);
      const accessTokenRes = jwt.sign({username:decodedToken.sub, accessToken},process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRE_TIME});
      // Convert Mongoose document to plain object and remove password
      const userData = result.toObject();
      userData.token = accessTokenRes;
      delete userData.password;
      await user.updateOne(
        { _id: result._id },
        { $set: { isConfirmed: true } }
      );
      // Step 6: Respond with success
      res.status(200).json({
        status: 1,
        message: "User confirmed successfully",
        userdata: userData,
      });
    } catch (error) {
      res.status(200).json({
        status: 0,
        message: "Error during confirmation",
        error: error.message || "Unknown error",
      });
    }
  },
  // Send OTP
  sendOtp: async (req, res) => {
    const { email } = req.body;
    try {
      if (typeof email !== 'string' || !validator.isEmail(email)) {
        return res.status(400).json({ status: 0, message: "Invalid email format" });
      }
      const safeEmail = email.trim().toLowerCase();
      const result = await user.findOne({ email: safeEmail });
      if (!result) {
        return res.status(200).json({status:0, message: "User not found" });
      }
      const paramsexists = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: email,
      };

      const userData = await cognito.adminGetUser(paramsexists).promise();
      if(!userData){
        return res.status(200).json({status:0, message: "User not found on cognito" });
      }

     
      const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
      const otpExpiry = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
      await user.updateOne(
        { email },
        { $set: { otp, otpExpiry } } // Update OTP and expiry
      );
      const params = {
        Source: process.env.MAIL_DRIVER,
        Destination: {
          ToAddresses: [email],
        },
        Message: {
          Subject: { Data: "Your OTP Code" },
          Body: {
            Text: { Data: `Your OTP is: ${otp}. It is valid for 5 minutes.` },
          },
        },
      };
      const emailSent = await SES.sendEmail(params).promise();
     // console.log("Email sent:", emailSent); // Log email send response
      res.status(200).json({status: 1, message: "Otp sent successfully" });
    } catch (error) {
      //console.error("Login error:", error);
      res
        .status(500)
        .json({ status: 0,message: "Error during Sending OTP", error: error.message });
    }
  },
  // Delete user from cognito and database
  deleteUser: async (req, res) => {
    const { email } = req.body;
  
    // Validate input
    if (typeof email !== 'string' || !validator.isEmail(email)) {
      return res.status(400).json({ status: 0, message: "Invalid email format" });
    }
  
    try {
      const result = await user.findOne({ email });
  
      if (!result) {
        return res.status(404).json({ status: 0, message: "User not found" });
      }
  
      const params = {
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: email,
      };
  
      await cognito.adminDeleteUser(params).promise();
      await user.deleteOne({ email });
  
      return res.status(200).json({ status: 1, message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({
        status: 0,
        message: "Error while deleting user",
        error: error.message,
      });
    }
  },
  // Login API
  login: async (req, res) => {
    const { email, otp } = req.body;
    try {
      if (typeof email !== 'string' || !validator.isEmail(email)) {
        return res.status(400).json({ status: 0, message: "Invalid email format" });
      }
      const result = await user.findOne({ email });
      // console.log(result);
      if (!result) {
        return res.status(200).json({ status: 0, message: "User not found" });
      }
  
      const isExpired = Date.now() - result.otpExpiry > 5 * 60 * 1000; // 5-minute expiration
  
      if (result.otp !== parseInt(otp, 10) || isExpired) {
        return res.status(500).json({
          status: 0,
          message: isExpired ? "OTP has expired." : "Invalid OTP.",
        });
      }
  
      const [{ encryptedData, iv }] = result.password;
      const decrypt_Password = decryptPassword(encryptedData, iv);
    
  
      const secretHash = getSecretHash(email);
      const params = {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: decrypt_Password,
          SECRET_HASH: secretHash,
        },
      };
      const data = await cognito.initiateAuth(params).promise();
 
      const accessToken = data.AuthenticationResult.AccessToken;
      const decodedToken = jwt.decode(accessToken);
      const accessTokenRes = jwt.sign({username:decodedToken.sub, accessToken},process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRE_TIME});
      // Convert Mongoose document to plain object and add token
      const userData = result.toObject(); // Convert to plain object
      userData.token = accessTokenRes; // Add token to the plain object
      delete userData.password;
      res.status(200).json({
        status: 1,
        message: "User logged in successfully",
        userdata: userData,
      });
    } catch (error) {
      //console.error("Login error:", error);
      res.status(500).json({
        status: 0,
        message: "Error during login",
        error: error.message,
      });
    }
  },
  // Resend Confirmation Code API (optional)
  resendConfirmationCode: async (req, res) => {
    const { email } = req.body;

    if (typeof email !== 'string' || !validator.isEmail(email)) {
      return res.status(400).json({ status: 0, message: "Invalid email format" });
    }
    
    const secretHash = getSecretHash(email); // Calculate the SECRET_HASH

    const params = {
      ClientId: process.env.COGNITO_CLIENT_ID,
      SecretHash: secretHash, // Include the SECRET_HASH
      Username: email,
    };

    try {
      // Resend the confirmation code
      await cognito.resendConfirmationCode(params).promise();
      res
        .status(200)
        .json({ status:1, message: "Confirmation code resent successfully" });
    } catch (error) {
      res
        .status(500)
        .json({status:0,message: "Error resending confirmation code", error });
    }
  },
};

// Helper function to calculate the SECRET_HASH
function getSecretHash(username) {
  const clientId = process.env.COGNITO_CLIENT_ID;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET;

  // Generate the HMAC-SHA256 hash of the username and clientId using the clientSecret
  return crypto
    .createHmac("SHA256", clientSecret)
    .update(username + clientId)
    .digest("base64");
}

function generatePassword(length) {
  if (length < 4) {
    throw new Error(
      "Password length must be at least 4 to include all required character types."
    );
  }

  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?";
  const charsetLength = charset.length;
  const password = [];

  while (password.length < length) {
    const byte = new Uint8Array(1);
    crypto.getRandomValues(byte);
    const value = byte[0];

    // To avoid bias, only use values < 256 that map evenly to charset
    if (value < Math.floor(256 / charsetLength) * charsetLength) {
      password.push(charset[value % charsetLength]);
    }
  }

  return password.join('');
}

function encryptPassword(password) {
  // Create the cipher using the algorithm, key, and IV
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  let encrypted = cipher.update(password, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return { encryptedData: encrypted, iv: iv.toString("hex") };
}


// Decrypt
function decryptPassword(encryptedData, iv) {
  const decipher = crypto.createDecipheriv(
    algorithm,
    secretKey,
    Buffer.from(iv, "hex")
  );
  let decrypted = decipher.update(encryptedData, "hex", "utf-8");
  decrypted += decipher.final("utf-8");
  return decrypted;
}

module.exports = authController;
