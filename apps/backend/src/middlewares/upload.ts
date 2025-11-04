// middlewares/upload.js
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
// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Function to upload to S3
async function uploadToS3(
    fileName: string,
    fileContent: Buffer | Uint8Array | Blob | string,
    mimeType: string
) {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;

    if (!bucketName) {
        throw new Error('AWS_S3_BUCKET_NAME is not defined in environment variables.');
    }
    const params: AWS.S3.PutObjectRequest = {
        Bucket: bucketName,
        Key: `${fileName}`,
        Body: fileContent,
        ContentType: mimeType,
        ContentDisposition: 'inline',
    };

     try {
        const data = await s3.upload(params).promise();
        return {
            location: data.Location,
            key: fileName,
        };
        } catch (err: unknown) {
        if (err instanceof Error) {
            throw new Error('Error uploading file to S3: ' + err.message);
        }
        throw new Error('Unknown error uploading file to S3');
        }
}

// Handle single file upload to S3
type FileUploadResult = {
    url: string
    key: string
    originalname: string
    mimetype: string
}

async function handleFileUpload(file: UploadedFile, folderName: string): Promise<FileUploadResult> {
    try {
        if (!file) {
            throw new Error('No file uploaded.');
        }

        if (!isAllowedMimeType(file.mimetype)) {
            throw new Error('Unsupported file type.');
        }

        const safeFileName = sanitizeFilename(file.name) || 'file';
        const fileExtension = path.extname(safeFileName);
        const fileName = `${folderName}/${uuidv4()}${fileExtension}`;

        const fileContent = file.data; // file.data should be a Buffer
        const mimeType = file.mimetype;

        const { location, key } = await uploadToS3(fileName, fileContent, mimeType);

        return {
            url: location,
            key,
            originalname: file.name,
            mimetype: file.mimetype,
        };
        
    
    } catch (err) {
        console.error('Error uploading file to S3:', err);
        throw err;
    }
}

// Handle multiple files upload to S3
async function handleMultipleFileUpload(files: UploadedFile[], folderName = "Images") {
    const uploadPromises = files.map((file) => handleFileUpload(file, folderName));
    return Promise.all(uploadPromises);
}

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
}

async function uploadBufferAsFile(
    buffer: Buffer,
    options: { folderName: string; mimeType: string; originalName?: string }
): Promise<FileUploadResult> {
    const { folderName, mimeType, originalName } = options

    if (!isAllowedMimeType) {
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

async function deleteFromS3(s3Key: string) {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;

    if (!bucketName) {
        throw new Error('AWS_S3_BUCKET_NAME is not defined in environment variables.');
    }

    const deleteParams = {
        Bucket: bucketName,
        Key: s3Key,
      };
      try {
        const headObject = await s3.headObject(deleteParams).promise();
        return headObject;
      } catch (error) {
        console.error("S3 File Not Found:", error);
      }
}

export { handleFileUpload, handleMultipleFileUpload, uploadBufferAsFile, deleteFromS3 };
export type { FileUploadResult };
