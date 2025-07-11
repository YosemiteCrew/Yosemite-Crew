import { handleMultipleFileUpload, deleteFromS3 } from "../middlewares/upload";

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
  }
}

export default helpers;

