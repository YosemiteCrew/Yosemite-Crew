import { Types, Document } from 'mongoose'
export interface ISubscriber extends Document {
  email: string;
  subscribed: boolean;
  user?: Types.ObjectId;
  countryCode: string;
  userType: "Pet Owner" | "Business" | "Developer";
  name: string;
}

export interface SubscriberData {
  email: string;
  subscribed: boolean;
  countryCode: string;
  userType: string;
  name: string;
  user?: Types.ObjectId;
}