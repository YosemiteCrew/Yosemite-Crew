

import { Types, Document } from 'mongoose'

export type contact = Document & {
  userId: Types.ObjectId;
  type?: string;
  submittedAs?: string;
  submittedTo?: string;
  law?: string;
  subject?: string;
  message?: string;
}