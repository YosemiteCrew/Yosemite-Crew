import mongoose from 'mongoose';

const petBoardingSchema = new mongoose.Schema({

    userId: {
        type: String,
        required: true,
    },
    boardingName: {
        type: String,
    },
    boardingAddress: {
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
const PetBoardingDetails = mongoose.model('PetBoardingDetails',petBoardingSchema);
module.exports = PetBoardingDetails;