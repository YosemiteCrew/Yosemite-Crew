import mongoose, { Schema, Model } from 'mongoose';
import type { exercises } from "@yosemite-crew/types";

const YoshExercisesSchema: Schema<exercises> = new mongoose.Schema({

    
    planId: {
        type: String,
    },
    planType: {
        type: String,
    },
    planName: {
        type: String,
    },
    exerciseType: {
        type: String,
    },
    exerciseTitle: {
        type: String,
    },
    exerciseSubTitle: {
        type: String,
    },
    exerciseThumbnail: {
        type: String,
    },
    exerciseVideo: {
        type: String,
    },
    exerciseDescription: {
        type: String,
    },
    
    
    

}, { timestamps: true});

const YoshExercises : Model<exercises>=  mongoose.model<exercises>('YoshExercises', YoshExercisesSchema);

export default YoshExercises;