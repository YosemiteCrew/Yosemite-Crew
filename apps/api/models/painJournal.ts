import mongoose from 'mongoose';

const painJournalSchema = new mongoose.Schema({

    userId: {
        type: Number, 
        required: true,
    },
    petId: {
        type: Number,  
        required: true,
    },
    typeOfAssessment: {
        type: String,
    },
    answers: {
        type: Array,
    },
 

}, { timestamps: true});


const YoshPainJournals = mongoose.model('YoshPainJournal',painJournalSchema);
module.exports = { YoshPainJournals };