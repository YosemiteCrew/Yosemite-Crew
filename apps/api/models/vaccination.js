const mongoose = require('mongoose');

const vaccinationSchema = new mongoose.Schema({

    userId: {
        type: String, 
        required: true,
    },
    petId: {
        type: String,  
        required: true,
    },
    manufacturerName: {
        type: String,
    },
    vaccineName: {
        type: String,
    },
    batchNumber: {
        type: String,
    },
    expiryDate: {
        type: Date,
    },
    vaccinationDate: {
        type: Date,
    },
    hospitalName: {
        type: String,
    },
    nextdueDate: {
        type: Date,
    },
    vaccineImage: [
        {
            url: { type: String },
            originalname: { type: String },
            mimetype: { type: String }
        }
    ],


}, { timestamps: true});
const YoshVaccine = mongoose.model('YoshVaccination',vaccinationSchema);
module.exports = YoshVaccine;