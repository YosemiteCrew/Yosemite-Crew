import mongoose, {Schema, Model} from 'mongoose';
import type { breeder } from "@yosemite-crew/types";

const breederSchema : Schema<breeder> = new mongoose.Schema({

    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "YoshUser"
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
    emailAddess: {
        type: String,
    },
    website: {
        type: String,
    }

}, { timestamps: true});
const BreederDetails : Model<breeder>= mongoose.model<breeder>('BreederDetails',breederSchema);
module.exports = BreederDetails;