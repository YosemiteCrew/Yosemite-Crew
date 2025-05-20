const mongoose = require('mongoose');

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
    emailAddess: {
        type: String,
    },
    website: {
        type: String,
    }

}, { timestamps: true});
const YoshPetGroomer = mongoose.model('YoshPetGroomer',petGroomerSchema);
module.exports = YoshPetGroomer;