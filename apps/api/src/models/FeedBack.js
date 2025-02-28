const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    fromId: { 
        type: String, 
    }, 
    toId: { 
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
    },
},
{
    timestamps: true,
});

module.exports = mongoose.model('feedback', feedbackSchema);