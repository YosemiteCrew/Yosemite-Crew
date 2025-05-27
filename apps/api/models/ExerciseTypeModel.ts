import mongoose from 'mongoose';

const YoshExerciseTypeSchema = new mongoose.Schema({

    
    exerciseType: {
        type: String,
    },
    
    
    

}, { timestamps: true});

const YoshExerciseType = mongoose.models.YoshExerciseType || mongoose.model('YoshExerciseType', YoshExerciseTypeSchema);

module.exports = YoshExerciseType;