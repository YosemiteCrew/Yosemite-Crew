import mongoose from 'mongoose';

const petGroomerSchema = new mongoose.Schema({

    userId: {
        type: String,
        required: true,
    },
    groomerName: {
        type: String,
    },
    groomerAddress: {
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
    emailAddress: {
        type: String,
    },
    website: {
        type: String,
    }

}, { timestamps: true});
const PetGroomer = mongoose.model('PetGroomer',petGroomerSchema);
module.exports = PetGroomer;