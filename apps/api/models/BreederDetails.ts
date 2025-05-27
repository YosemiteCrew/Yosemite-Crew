import mongoose from 'mongoose';

const breederSchema = new mongoose.Schema({

    userId: {
        type: String,
        required: true,
    },
    breederName: {
        type: String,
    },
    breederAddress: {
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
const BreederDetails = mongoose.model('BreederDetails',breederSchema);
module.exports = BreederDetails;