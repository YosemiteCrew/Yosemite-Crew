import mongoose , { Schema, Model} from 'mongoose';
import type { exercisePlanType } from "@yosemite-crew/types";


const YoshExercisePlansSchema :Schema<exercisePlanType> = new mongoose.Schema({

    planType: {
        type: String,
    },
    planName: {
        type: String,
    },

}, { timestamps: true});

const YoshExercisePlans : Model<exercisePlanType> = mongoose.model<exercisePlanType>('YoshExercisePlans', YoshExercisePlansSchema);

export default YoshExercisePlans;