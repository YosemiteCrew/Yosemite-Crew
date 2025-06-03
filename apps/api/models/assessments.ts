import mongoose, {Schema, Model} from 'mongoose';
import type { IAssessment } from "@yosemite-crew/types";

const assessmentsSchema : Schema<IAssessment>= new mongoose.Schema({
    
    userId: {
         type: Schema.Types.ObjectId,
         required: true,
    },
    hospitalId: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    assessmentId: {
         type: Schema.Types.ObjectId,
        required: true,
    },
    petId: {
         type: Schema.Types.ObjectId,
        required : true
    },
    doctorId: {
         type: Schema.Types.ObjectId,
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
const YoshAssessments : Model<IAssessment>= mongoose.model<IAssessment>('Yoshassessments',assessmentsSchema);
export default YoshAssessments;
