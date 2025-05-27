import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
    userId: { 
        type: String, 
    }, 
    doctorId: { 
        type: String, 
    }, 
    petId: { 
        type: String, 
    }, 
    meetingId: { 
        type: String, 
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

module.exports = mongoose.model('feedback', feedbackSchema);