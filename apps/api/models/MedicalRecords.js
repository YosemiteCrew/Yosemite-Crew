const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({

    userId: {
        type: String, 
        required: true,
    },
    documentType: {
        type: String,
    },
    title: {
        type: String,
    },
    issueDate: {
        type: String,
    },
    expiryDate: {
        type: String,
    },
    medicalDocs: [
        {
            url: { type: String },
            originalname: { type: String },
            mimetype: { type: String }
        }
    ],

}, { timestamps: true});

const medicalRecord = mongoose.model('MedicalRecords',medicalRecordSchema);
module.exports = medicalRecord;