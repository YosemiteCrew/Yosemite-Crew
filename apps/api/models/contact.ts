import mongoose, {Schema, Model} from 'mongoose';
import type { contact } from "@yosemite-crew/types";


const contactUsSchema : Schema<contact> = new mongoose.Schema({

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
const contactus : Model<contact> = mongoose.model<contact>('Contacts',contactUsSchema);
export default contactus;