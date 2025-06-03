

import { Types, Document } from 'mongoose'

export interface IContact extends Document {
  userId: Types.ObjectId;
  type?: string;
  submittedAs?: string;
  submittedTo?: string;
  law?: string;
  subject?: string;
  message?: string;
}


export interface ContactData {
  userId: Types.ObjectId;
  type?: string;
  submittedAs?: string;
  submittedTo?: string;
  law?: string;
  subject?: string;
  message?: string;
}