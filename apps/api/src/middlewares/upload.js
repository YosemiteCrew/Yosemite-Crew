// middlewares/upload.js
const fs = require('fs');
const AWS = require('aws-sdk');
const path = require('path');

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Function to upload to S3
async function uploadToS3(fileName, fileContent) {
    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        Body: fileContent,
        ContentType: 'image/jpeg',
        ContentDisposition: 'inline',
    };

    try {
        const data = await s3.upload(params).promise();
        return data.Location;
    } catch (err) {
        throw new Error('Error uploading file to S3: ' + err.message);
    }
}

async function handleFileUpload(file) {
    try {
        if (!file) {
            throw new Error('No file uploaded.');
        }

        const uploadDir = path.resolve(__dirname, 'Uploads/Images');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const currentDate = Date.now();
        const originalFileName = file.name;
        const documentFileName = `${currentDate}-${originalFileName}`;
        const filePath = path.join(uploadDir, documentFileName);
        
        await file.mv(filePath);

        const fileContent = fs.readFileSync(filePath);
        const imageUrl = await uploadToS3(documentFileName, fileContent);

        fs.unlinkSync(filePath);

        return imageUrl; // Return the S3 URL instead of the local file path
    } catch (err) {
        console.error('Error in file upload process:', err);
        throw err;
    }
}

// Function to handle multiple file uploads
async function handleMultipleFileUpload(files) {
    const uploadPromises = files.map(file => handleFileUpload(file));
    return Promise.all(uploadPromises);
}

module.exports = {
    handleFileUpload,
    handleMultipleFileUpload
};