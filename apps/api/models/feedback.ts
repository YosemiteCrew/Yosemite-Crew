import mongoose , { Schema, Model} from 'mongoose';
import type { feedback } from "@yosemite-crew/types";

const feedbackSchema :Schema<feedback>= new mongoose.Schema({
    userId: { 
        type: String,
        required : true,
    }, 
    doctorId: { 
       type: String, 
        required : true,

    }, 
    petId: { 
        type: String, 
        required : true,
    }, 
    meetingId: { 
        type: String, 
        required : true,
    }, 
    feedback: { 
        type: String, 
    }, 
    rating: {
        type: Number,
        default:0 
    }
},
{
    timestamps: true,
});
const feedbacks : Model<feedback>= mongoose.model<feedback>('feedback', feedbackSchema);

export default feedbacks;