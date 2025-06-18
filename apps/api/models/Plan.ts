import mongoose,  {Schema, Model} from 'mongoose';
import type { plan } from "@yosemite-crew/types";

const exercisePlanSchema : Schema<plan> = new mongoose.Schema({

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
const ExercisePlans:Model<plan> = mongoose.model<plan>('ExercisePlans',exercisePlanSchema);
export default ExercisePlans;