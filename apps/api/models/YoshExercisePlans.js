const mongoose = require('mongoose');

const YoshExercisePlansSchema = new mongoose.Schema({

    
    planType: {
        type: String,
    },
    planName: {
        type: String,
    },
    
    
    

}, { timestamps: true});

const YoshExercisePlans = mongoose.models.YoshExercisePlans || mongoose.model('YoshExercisePlans', YoshExercisePlansSchema);

module.exports = YoshExercisePlans;