const mongoose = require('mongoose');
const recordSchema = new mongoose.Schema({

    userId: {
        type: String,
        required: true,
    },
    petId: {
        type: String, 
        required: true,
    },
    doctorId: {
        type: String,
    },
    recordDate: {
        type: Date,
    },
    recordTime: {
        type: String,
    },
    waterIntake: {
        type: String,
    },
    foodIntake: {
        type: String,
    },
    activityLevel: {
        type: String,
    },
    urination: {
        type: String,
    },
    signOfIllness: {
        type: String,
    },
    bloodGlucose: {
        type: String,
    },
    urineGlucose: {
        type: String,
    },
    urineKetones: {
        type: String,
    },
    weight: {
        type: String,
    },
    bodyCondition:[
        {
            url: { type: String },
            originalname: { type: String },
            mimetype: { type: String }
        }
    ],
   

}, { timestamps: true});

const diabetesRecord = mongoose.model('YoshDiabetesRecords',recordSchema);
module.exports = diabetesRecord;