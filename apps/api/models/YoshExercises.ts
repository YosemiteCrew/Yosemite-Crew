import mongoose from 'mongoose';

const YoshExercisesSchema = new mongoose.Schema({

    
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

const YoshExercises = mongoose.models.YoshExercises || mongoose.model('YoshExercises', YoshExercisesSchema);

module.exports = YoshExercises;