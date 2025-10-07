import { handleMultipleFileUpload, deleteFromS3 } from "../middelwares/upload"
import { S3 } from "aws-sdk";
import crypto from "crypto";
interface UploadedFile {
  name: string;
  mimetype: string;
  data: Buffer;
}

const helpers =  {
calculateAge: (date: string | Date): number => {
  const dob = new Date(date);
  const diff = Date.now() - dob.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
},
 capitalizeFirstLetter: (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
},

  operationOutcome:(
    status: string,
    severity: string,
    code: string,
    diagnostics: string
  ) => {
    return {
      resourceType: "OperationOutcome",
      issue: [
        {
          status,
          severity,
          code,
          diagnostics,
        },
      ],
    };
  },
  convertTo24Hour: (timeStr: string) => {
    const [time, modifier] = timeStr.split(" ");
    let hours: string;
    const minutes: string = time.split(":")[1];
    hours = time.split(":")[0];

    if (modifier === "PM" && hours !== "12") {
      hours = (parseInt(hours, 10) + 12).toString();
    }
    if (modifier === "AM" && hours === "12") {
      hours = "00";
    }

    return `${hours}:${minutes}`;

    },

  uploadFiles: async (files: UploadedFile | UploadedFile[]) => {
    const fileArray = Array.isArray(files) ? files : [files];
    return await handleMultipleFileUpload(fileArray, "Images");
  },

  deleteFiles: async (fileurl: string) => {
    return await deleteFromS3(fileurl);
  },

  getS3Instance: () =>{
    const s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      region: process.env.AWS_REGION!,
    });
    return s3;
  },
  getSecretHash(username: string): string {
  const clientId = process.env.COGNITO_CLIENT_ID!;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET!;
  return crypto.createHmac('SHA256', clientSecret)
    .update(username + clientId)
    .digest('base64');
  },
  generatePassword(length: number): string {
    if (length < 8) {
      throw new Error("Password length must be at least 8 characters to meet Cognito policy.");
    }

    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const specials = "!@#$%^&*()_+[]{}|;:,.<>?";

    const allChars = upper + lower + digits + specials;

    // Ensure each requirement is met
    const password: string[] = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
      specials[Math.floor(Math.random() * specials.length)],
    ];

    // Fill the rest randomly
    while (password.length < length) {
      const value = crypto.randomBytes(1)[0];
      if (value < Math.floor(256 / allChars.length) * allChars.length) {
        password.push(allChars[value % allChars.length]);
      }
    }

    // Shuffle to avoid predictable placement
    return password
      .sort(() => 0.5 - Math.random())
      .join('');
  },
  formatAppointmentDateTime(rawDateTime: string) {
  // Use the given string as-is, respecting the +05:30 offset
  const dateObj = new Date(rawDateTime);

  // Extract YYYY-MM-DD (with local offset from the input string)
  const [datePart] = rawDateTime.split("T");
  const appointmentDate = datePart;

  // Format 12h (AM/PM) in the same timezone
  const options12: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata", // because offset is +05:30
  };
  const appointmentTime = dateObj.toLocaleTimeString("en-US", options12);

  // Format 24h (HH:mm) in the same timezone
  const options24: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  };
  const appointmentTime24 = dateObj.toLocaleTimeString("en-GB", options24);

  return { appointmentDate, appointmentTime, appointmentTime24 };
}


}

export default helpers;

