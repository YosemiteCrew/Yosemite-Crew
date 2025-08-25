import mongoose, {Schema, Model, HydratedDocument} from 'mongoose';
import type { breeder } from "@yosemite-crew/types";

export type BreederDocument = HydratedDocument<breeder>;

const breederSchema : Schema<breeder> = new mongoose.Schema({

    userId: {
        type: String, required: true
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
    },
    website: {
        type: String,
    },
    petId:{type:Schema.Types.ObjectId,ref: "pets",}

}, { timestamps: true});

const BreederDetails: Model<breeder> = mongoose.model<breeder>('BreederDetails', breederSchema);

export default BreederDetails;

