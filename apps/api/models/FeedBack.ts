import mongoose , { Schema, Model}from 'mongoose';
import type { IFeedback } from "@yosemite-crew/types";

const feedbackSchema :Schema<IFeedback>= new mongoose.Schema({
    userId: { 
        type: Schema.Types.ObjectId, 
        required : true,
        ref:"YoshUser"
    }, 
    doctorId: { 
       type: Schema.Types.ObjectId, 
        required : true,
        ref:"adddoctors"
    }, 
    petId: { 
        type: Schema.Types.ObjectId, 
        required : true,
        ref:"pets"
    }, 
    meetingId: { 
        type: Schema.Types.ObjectId, 
        required : true,
        ref:"webappointments"
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
const feedback : Model<IFeedback>= mongoose.model<IFeedback>('feedback', feedbackSchema);

export default feedback;