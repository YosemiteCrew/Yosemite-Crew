export interface S3File {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

export interface UploadFileToS3 {
  (file: S3File): Promise<string>;
}