import mongoose , {Schema, Model } from 'mongoose';
import type { painJournal } from "@yosemite-crew/types";


const painJournalSchema : Schema<painJournal> = new mongoose.Schema({

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


const yoshPainJournals : Model<painJournal>= mongoose.model<painJournal>('YoshPainJournal',painJournalSchema);
export default yoshPainJournals ;