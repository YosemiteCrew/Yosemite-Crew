// middlewares/upload.js
const fs = require('fs');
const AWS = require('aws-sdk');

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

// Function to handle single file upload
async function handleFileUpload(file) {
    try {
        if (!file) {
            throw new Error('No file uploaded.');
        }

        const currentDate = Date.now();
        const originalFileName = file.name;
        const documentFileName = `${currentDate}-${originalFileName}`;
        const filePath = `Uploads/Images/${documentFileName}`;
        await file.mv(filePath);

        const fileContent = fs.readFileSync(filePath);
        const imageUrl = await uploadToS3(documentFileName, fileContent);

        fs.unlinkSync(filePath);

        return filePath;
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