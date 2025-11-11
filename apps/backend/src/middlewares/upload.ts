// helpers/upload.ts
import AWS from 'aws-sdk';
import path from 'node:path';
import sanitizeFilename from 'sanitize-filename';
import { v4 as uuidv4 } from 'uuid';

interface UploadedFile {
  name: string;
  mimetype: string;
  data: Buffer;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const isAllowedMimeType = (mimeType: string) => ALLOWED_MIME_TYPES.has(mimeType);

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const getBucketName = (): string => {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET_NAME is not defined.');
  }
  return bucket;
};

// Utility functions

const mimeTypeToExtension = (mimeType: string): string => {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'application/pdf':
      return '.pdf';
    default:
      return '';
  }
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string | number }).code;
    return code == null ? undefined : String(code);
  }

  return undefined;
};

const buildS3Key = (
  type: 'temp' | 'user' | 'org' | 'custom',
  idOrFolder?: string,
  mimeType?: string
): string => {
  const ext = mimeType ? mimeTypeToExtension(mimeType) : '';
  switch (type) {
    case 'temp':
      return `temp/uploads/${uuidv4()}${ext}`;
    case 'user':
      return `users/${idOrFolder}/profile${ext}`;
    case 'org':
      return `orgs/${idOrFolder}/logo${ext}`;
    case 'custom':
      return `${idOrFolder}/${uuidv4()}${ext}`;
    default:
      throw new Error('Invalid upload type');
  }
};

// Direct Upload Handlers

async function uploadToS3(
  fileName: string,
  fileContent: Buffer | Uint8Array | Blob | string,
  mimeType: string
) {
  const bucket = getBucketName();
  const params: AWS.S3.PutObjectRequest = {
    Bucket: bucket,
    Key: fileName,
    Body: fileContent,
    ContentType: mimeType,
    ContentDisposition: 'inline',
  };

  try {
    const data = await s3.upload(params).promise();
    return { location: data.Location, key: fileName };
  } catch (err: unknown) {
    console.error('Error uploading file to S3:', err);
    throw new Error(`S3 upload failed: ${getErrorMessage(err)}`);
  }
}

// Upload bufferd files to S3

async function uploadBufferAsFile(
    buffer: Buffer,
    options: { folderName: string; mimeType: string; originalName?: string }
): Promise<FileUploadResult> {
    const { folderName, mimeType, originalName } = options

    if (!isAllowedMimeType(mimeType)) {
        throw new Error('Unsupported file type.');
    }

    const safeOriginal = sanitizeFilename(originalName ?? 'file') || 'file'
    const extension = path.extname(safeOriginal) || mimeTypeToExtension(mimeType)
    const fileName = `${folderName}/${uuidv4()}${extension}`
    let originalnameWithExtension = safeOriginal;
    
    if (extension && !safeOriginal.endsWith(extension)) {
    originalnameWithExtension = `${safeOriginal}${extension}`;
    }
    const { location, key } = await uploadToS3(fileName, buffer, mimeType)

    return {
        url: location,
        key,
        originalname: originalnameWithExtension,
        mimetype: mimeType,
    }
}

// Presigned URL Generation

async function generatePresignedUrl(
  mimeType: string,
  type: 'temp' | 'user' | 'org' | 'custom',
  idOrFolder?: string
) {
  const bucket = getBucketName();
  const key = buildS3Key(type, idOrFolder, mimeType);
  const params = {
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
    Expires: 60, // 1 minute validity
  };

  try {
    const url = await s3.getSignedUrlPromise('putObject', params);
    return { url, key };
  } catch (err: unknown) {
    console.error('Error generating presigned URL:', err);
    throw new Error(`Failed to generate presigned URL: ${getErrorMessage(err)}`);
  }
}

// Move File within S3

async function moveFile(fromKey: string, toKey: string) {
  const bucket = getBucketName();
  try {
    await s3
      .copyObject({
        Bucket: bucket,
        CopySource: `${bucket}/${fromKey}`,
        Key: toKey,
      })
      .promise();

    await s3
      .deleteObject({
        Bucket: bucket,
        Key: fromKey,
      })
      .promise();

    return `https://${bucket}.s3.amazonaws.com/${toKey}`;
  } catch (err: unknown) {
    console.error('Error moving file:', err);
    throw new Error(`Failed to move file: ${getErrorMessage(err)}`);
  }
}

// Delete File from S3

async function deleteFromS3(s3Key: string) {
  const bucket = getBucketName();
  try {
    await s3
      .deleteObject({
        Bucket: bucket,
        Key: s3Key,
      })
      .promise();
  } catch (error) {
    console.error('Error deleting S3 object:', error);
    throw error;
  }
}

// File Upload Handler

type FileUploadResult = {
  url: string;
  key: string;
  originalname: string;
  mimetype: string;
};

async function handleFileUpload(
  file: UploadedFile,
  folderName: string
): Promise<FileUploadResult> {
  if (!file) throw new Error('No file uploaded.');
  if (!isAllowedMimeType(file.mimetype)) throw new Error('Unsupported file type.');

  const safeFileName = sanitizeFilename(file.name) || 'file';
  const fileExtension = path.extname(safeFileName) || mimeTypeToExtension(file.mimetype);
  const fileName = `${folderName}/${uuidv4()}${fileExtension}`;

  const { location, key } = await uploadToS3(fileName, file.data, file.mimetype);

  return {
    url: location,
    key,
    originalname: file.name,
    mimetype: file.mimetype,
  };
}

async function handleMultipleFileUpload(files: UploadedFile[], folderName = 'uploads') {
  const uploads = files.map((f) => handleFileUpload(f, folderName));
  return Promise.all(uploads);
}

// Lifecycle 

async function setupLifecyclePolicy(daysToKeep = 2) {
  const ruleName = 'AutoDeleteTempUploads';
  const bucket = getBucketName();

  try {
    const currentConfig = await s3.getBucketLifecycleConfiguration({ Bucket: bucket }).promise();

    // Check if rule already exists
    const existingRule = currentConfig.Rules?.find((r) => r.ID === ruleName);
    if (existingRule) {
      console.log(`Lifecycle rule "${ruleName}" already exists ✅`);
      return;
    }

    // Add new rule
    const newRule: AWS.S3.LifecycleRule = {
      ID: ruleName,
      Prefix: 'temp/', // applies to everything under temp/
      Status: 'Enabled',
      Expiration: { Days: daysToKeep },
    };

    const updatedRules = [...(currentConfig.Rules || []), newRule];

    await s3
      .putBucketLifecycleConfiguration({
        Bucket: bucket,
        LifecycleConfiguration: { Rules: updatedRules },
      })
      .promise();

    console.log(`Lifecycle rule added ✅: Delete temp/ files after ${daysToKeep} days`);
  } catch (err: unknown) {
    // If no existing lifecycle config found, create a new one
    if (getErrorCode(err) === 'NoSuchLifecycleConfiguration') {
      await s3
        .putBucketLifecycleConfiguration({
          Bucket: bucket,
          LifecycleConfiguration: {
            Rules: [
              {
                ID: ruleName,
                Prefix: 'temp/',
                Status: 'Enabled',
                Expiration: { Days: daysToKeep },
              },
            ],
          },
        })
        .promise();
      console.log(`Lifecycle configuration created ✅: temp/ auto-delete after ${daysToKeep} days`);
    } else {
      console.error('Error setting lifecycle policy:', err);
      throw new Error(`Failed to set lifecycle policy: ${getErrorMessage(err)}`);
    }
  }
}

// Exports

export {
  handleFileUpload,
  handleMultipleFileUpload,
  uploadToS3,
  uploadBufferAsFile,
  generatePresignedUrl,
  moveFile,
  deleteFromS3,
  buildS3Key,
  mimeTypeToExtension,
  setupLifecyclePolicy
};
export type { FileUploadResult, UploadedFile };
