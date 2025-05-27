import mongoose from 'mongoose';

const exercisePlanSchema = new mongoose.Schema({

    userId: {
        type: Number, 
        required: true,
    },
    petId: {
        type: Number,  
        required: true,
    },
    typeOfPlan: {
        type: String,
    },
    condition: {
        type: String,
    },
    weeksSinceSurgery: {
        type: String,
    },
    mobilityLevel: {
        type: String,
    },
    painLevel: {
        type: String,
    },

}, { timestamps: true});
const ExercisePlans = mongoose.model('ExercisePlans',exercisePlanSchema);
module.exports = ExercisePlans;