export interface UploadedFile {
  name: string;
  mimetype: string;
  data: Buffer;
}

export interface Helpers {
  calculateAge: (date: string | Date) => Promise<number>;
  capitalizeFirstLetter: (str: string) => string;
  operationOutcome: (
    status: string,
    severity: string,
    code: string,
    diagnostics: string
  ) => {
    resourceType: string;
    issue: {
      status: string;
      severity: string;
      code: string;
      diagnostics: string;
    }[];
  };
  convertTo24Hour: (timeStr: string) => string;
  uploadFiles: (files: UploadedFile | UploadedFile[]) => Promise<
    {
      url: string;
      originalname: string;
      mimetype: string;
    }[]
  >;
  deleteFiles: (fileurl: string) => Promise<void>;
}
