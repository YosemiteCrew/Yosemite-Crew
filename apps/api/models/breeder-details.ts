import mongoose, { Schema, Model } from 'mongoose';
import type { breeder } from "@yosemite-crew/types";

const breederSchema: Schema<breeder> = new mongoose.Schema({
   userId: {
    type: String,
    required: true,
    },
    breederName: {
        type: String,
    },
    breederAddress: {
        type: String,
    },
    city: {
        type: String,
    },
    country: {
        type: String,
    },
    zipCode: {
        type: String,
    },
    telephone: {
        type: String,
    },
    emailAddress: {
        type: String,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    website: {
        type: String,
        match: [/^https?:\/\/.+/, 'Please enter a valid URL'],
    }
}, { timestamps: true });

const BreederDetails: Model<breeder> = mongoose.model<breeder>('BreederDetails', breederSchema);
export default BreederDetails;