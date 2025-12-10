import { handleMultipleFileUpload, deleteFromS3 } from "../middlewares/upload";
import axios from "axios";
import crypto from "node:crypto";
interface UploadedFile {
  name: string;
  mimetype: string;
  data: Buffer;
}

const helpers = {
  calculateAge: (date: string | Date): number => {
    const dob = new Date(date);
    const diff = Date.now() - dob.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  },
  capitalizeFirstLetter: (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  operationOutcome: (
    status: string,
    severity: string,
    code: string,
    diagnostics: string,
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
      hours = (Number.parseInt(hours, 10) + 12).toString();
    }
    if (modifier === "AM" && hours === "12") {
      hours = "00";
    }

    return `${hours}:${minutes}`;
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
  },

  async getGeoLocation(query: string) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${process.env.GOOGLE_API_KEY}`;

    const res = await axios.get(url);
    if (!res.data.results.length) throw new Error("Location not found");

    const { lat, lng } = res.data.results[0].geometry.location;
    return { lat, lng };
  },
};

export default helpers;
