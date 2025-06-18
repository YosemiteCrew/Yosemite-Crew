import mongoose from 'mongoose';

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
    reminder: {
        type: Boolean,
        default: false,
    },
    vaccineImage: [
        {
            url: { type: String },
            originalname: { type: String },
            mimetype: { type: String }
        }
    ],


}, { timestamps: true});
const VaccinationDetails = mongoose.model('VaccinationDetails',vaccinationSchema);
module.exports = VaccinationDetails;