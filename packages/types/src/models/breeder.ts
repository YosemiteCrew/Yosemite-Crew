
import { Types, Document } from 'mongoose'

export interface IBreeder extends Document {
  userId: Types.ObjectId;
  breederName?: string;
  breederAddress?: string;
  city?: string;
  country?: string;
  zipCode?: string;
  telephone?: string;
  emailAddess?: string; // kept the same name as in your original schema
  website?: string;
}


export interface BreederData {
  userId: Types.ObjectId;
  breederName?: string;
  breederAddress?: string;
  city?: string;
  country?: string;
  zipCode?: string;
  telephone?: string;
  emailAddess?: string; // kept the same name as in your original schema
  website?: string;
}
