import mongoose, { Schema, Model} from 'mongoose';
import type { exerciseType } from "@yosemite-crew/types";

const YoshExerciseTypeSchema : Schema<exerciseType>= new mongoose.Schema({

    exerciseType: {
        type: String,
    },

}, { timestamps: true});

const YoshExerciseType : Model<exerciseType>= mongoose.model<exerciseType>('YoshExerciseType', YoshExerciseTypeSchema);

export default YoshExerciseType;