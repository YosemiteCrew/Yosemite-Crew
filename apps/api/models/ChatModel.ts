import mongoose, { Schema, Model } from 'mongoose';
import type { IMessage } from '@yosemite-crew/types';

const messageSchema: Schema<IMessage> = new mongoose.Schema({
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
}, { timestamps: true });

const Message: Model<IMessage> = mongoose.model<IMessage>('Message', messageSchema);
export default Message
