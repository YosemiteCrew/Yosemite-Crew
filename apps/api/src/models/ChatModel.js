const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  content: { type: String, default: '' }, // Text message
  fileUrl: { type: String, default: '' }, // Store file name only
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'document'],
    required: true,
  },
  timestamp: { type: Date, default: Date.now },
  time: {
    type: String,
    required: true,
  },
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
