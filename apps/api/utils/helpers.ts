import { handleMultipleFileUpload, deleteFromS3 } from "../middlewares/upload";

interface UploadedFile {
  name: string;
  mimetype: string;
  data: Buffer;
}

class helpers {
  static async calculateAge(date: string | Date): Promise<number> {
    const dob = new Date(date);
    const diff = Date.now() - dob.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  }
  static async capitalizeFirstLetter(string: string): Promise<string> {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  }

  static async operationOutcome(
    status: string,
    severity: string,
    code: string,
    diagnostics: string
  ) {
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
  }
  static async convertTo24Hour(timeStr: string) {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":");
    if (modifier === "PM" && hours !== "12") hours = (parseInt(hours, 10) + 12).toString();
    if (modifier === "AM" && hours === "12") hours = "00";
    return `${hours}:${minutes}`;
  }

  static async uploadFiles(files: UploadedFile | UploadedFile[]) {
    const fileArray = Array.isArray(files) ? files : [files];
    return await handleMultipleFileUpload(fileArray, "Images");
  }

  static async deleteFiles(fileurl: string) {
    return await deleteFromS3(fileurl);
  }
}

export default helpers;
