export interface UploadedFile {
  name?: string;
  data?: Buffer;
  size?: number;
  encoding?: string;
  tempFilePath?: string;
  truncated?: boolean;
  mimetype?: string;
  md5?: string;
  type?: string;
  date?: Date;
  mv: (path: string, callback: (err: any) => void) => void;
}
