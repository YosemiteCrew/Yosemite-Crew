import mongoose from 'mongoose';

const vetSchema = new mongoose.Schema({

    userId: {
        type: String,
        required: true,
    },
    clinicName: {
        type: String,
    },
    vetName: {
        type: String,
    },
    clinicAddress: {
        type: String,
    },
    city: {
        type: String,
    },
    country: {
        type: String,
    },
    zipCode: {
        type: String,
    },
    telephone: {
        type: String,
    },
    emailAddess: {
        type: String,
    },
    website: {
        type: String,
    }

}, { timestamps: true});
const VetClinic = mongoose.model('VetClinic',vetSchema);
module.exports = VetClinic;