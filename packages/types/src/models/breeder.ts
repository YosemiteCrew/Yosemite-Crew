
import { Types, Document } from 'mongoose'

export type breeder =  Document &{
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


export type breederData = {
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
