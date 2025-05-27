import mongoose from 'mongoose';

const contactUsSchema = new mongoose.Schema({

    userId: {
        type: Number,
        required: true,
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
const Contacts = mongoose.model('Contacts',contactUsSchema);
module.exports = Contacts;