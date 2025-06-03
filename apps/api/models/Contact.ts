import mongoose, {Schema, Model} from 'mongoose';
import type { IContact } from "@yosemite-crew/types";


const contactUsSchema : Schema<IContact> = new mongoose.Schema({

    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "YoshUser",
    },
    type: {
        type: String,
    },
    submittedAs: {
        type: String,
    },
    submittedTo: {
        type: String,
    },
    law: {
        type: String,
    },
    subject: {
        type: String,
    },
    message: {
        type: String,
    },

}, { timestamps: true});
const Contacts : Model<IContact> = mongoose.model<IContact>('Contacts',contactUsSchema);
module.exports = Contacts;