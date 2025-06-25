import mongoose, {Schema, Model} from 'mongoose';
import type { diabetesRecords } from "@yosemite-crew/types";

const recordSchema: Schema<diabetesRecords> = new mongoose.Schema({

    userId: {
        type: String,
        required: true,
    },
    petId: {
        type: String, 
        required: true,
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


const diabetesRecord : Model<diabetesRecords> = mongoose.model<diabetesRecords>('DiabetesRecords',recordSchema);
export default diabetesRecord;

