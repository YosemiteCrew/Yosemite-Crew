import mongoose,  {Schema, Model} from 'mongoose';
import type { plan } from "@yosemite-crew/types";

const exercisePlanSchema : Schema<plan> = new mongoose.Schema({

    userId: {
        type: String, 
        required: true,
    },
    petId: {
        type: String,  
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