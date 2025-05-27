import mongoose from 'mongoose';

const assessmentsSchema = new mongoose.Schema({
    
    userId: {
        type: String, 
        required: true,
    },
    hospitalId: {
        type: String,
        required: true,
    },
    assessmentId: {
        type: String,
        required: true,
    },
    petId: {
        type: String,
        required : true
    },
    doctorId: {
        type: String,
    },
    assessmentType: {
        type: String,
    },
    type: {
        type: String,
    },
    questions: {
        type: Array,
    },
    score: {
        type: Number,
    },
    assessmentStatus:{
        type: String,
        default: 'New'
    }

}, { timestamps: true});
const YoshAssessments = mongoose.model('Yoshassessments',assessmentsSchema);
module.exports = YoshAssessments;
