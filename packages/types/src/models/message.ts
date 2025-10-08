import { Document } from 'mongoose';

export interface IMessage extends Document {
  sender: string;
  receiver: string;
  content?: string;
  fileUrl?: string;
  type: MessageType;
  timestamp : Date;
  time: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type MessageType = 'text' | 'image' | 'video' | 'document';
