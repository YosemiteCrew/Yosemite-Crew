// middlewares/upload.js
import AWS from 'aws-sdk';
import path from 'path';
import sanitizeFilename from 'sanitize-filename';
import { v4 as uuidv4 } from 'uuid';

interface UploadedFile {
  name: string;
  mimetype: string;
  data: Buffer;
}

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Function to upload to S3
async function uploadToS3(fileName: string, fileContent: Buffer | Uint8Array | Blob | string, mimeType: string) {
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
        return data.Location; // URL of uploaded file
    } catch (err: any) {
        throw new Error('Error uploading file to S3: ' + err.message);
    }
}

// Handle single file upload to S3
async function handleFileUpload(file: UploadedFile, folderName: string) {
    try {
        if (!file) {
            throw new Error('No file uploaded.');
        }

        const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new Error('Unsupported file type.');
        }

        const safeFileName = sanitizeFilename(file.name) || 'file';
        const fileExtension = path.extname(safeFileName);
        const fileName = `${folderName}/${uuidv4()}${fileExtension}`;

        const fileContent = file.data; // file.data should be a Buffer
        const mimeType = file.mimetype;

        const s3Url = await uploadToS3(fileName, fileContent, mimeType);

        //return fileName;
        return {
            url: fileName,
            originalname: file.name,
            mimetype: file.mimetype
          };
        
    
    } catch (err) {
        console.error('Error uploading file to S3:', err);
        throw err;
    }
}

// Handle multiple files upload to S3
async function handleMultipleFileUpload(files: UploadedFile[],folderName="Images") {
    const uploadPromises = files.map(file => handleFileUpload(file,folderName));
    return Promise.all(uploadPromises);
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
        // console.log('S3 File Found:', headObject);
      } catch (headErr) {
        console.error("S3 File Not Found:", headErr);
        // return res.status(404).json({ message: "File not found in S3" });
      }
}

export { handleFileUpload, handleMultipleFileUpload, deleteFromS3 };
