import mongoose, {Schema, Model} from 'mongoose';
import type { IBreeder } from "@yosemite-crew/types";

const breederSchema : Schema<IBreeder> = new mongoose.Schema({

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
const BreederDetails : Model<IBreeder>= mongoose.model<IBreeder>('BreederDetails',breederSchema);
module.exports = BreederDetails;