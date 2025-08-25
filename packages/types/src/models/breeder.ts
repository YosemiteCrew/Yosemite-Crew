
import { Types, Document } from 'mongoose'

export interface breeder {
  _id?: string;
  userId: string;
  breederName?: string;
  breederAddress?: string;
  city?: string;
  country?: string;
  zipCode?: string;
  telephone?: string;
  emailAddress?: string; // kept the same name as in your original schema
  website?: string;
  petId?: Types.ObjectId;
}


export type breederData = {
  userId: Types.ObjectId;
  breederName?: string;
  breederAddess?: string;
  city?: string;
  country?: string;
  zipCode?: string;
  telephone?: string;
  emailAddress?: string; // kept the same name as in your original schema
  website?: string;
}
