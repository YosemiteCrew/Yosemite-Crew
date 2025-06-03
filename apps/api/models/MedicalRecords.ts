import mongoose, {Schema, Model} from 'mongoose';
import type { IMedicalDoc, IMedicalRecord } from "@yosemite-crew/types";




const medicalDocSchema : Schema<IMedicalDoc>= new mongoose.Schema({
  url: { type: String },
  originalname: { type: String },
  mimetype: { type: String }
}, { _id: false });


const medicalRecordSchema : Schema<IMedicalRecord>= new mongoose.Schema({

    userId: {
        type: Schema.Types.ObjectId, 
        required: true,
        ref: 'YoshUser'
    },
    documentType: {
        type: String,
    },
    title: {
        type: String,
    },
    issueDate: {
        type: String,
    },
    hasExpiryDate: {
        type: Boolean,
        default: false,
    },
    petId: {
        type: String,
    },
    expiryDate: {
        type: String,
    },
    medicalDocs: [medicalDocSchema],

}, { timestamps: true});

const medicalRecord : Model<IMedicalRecord> = mongoose.model<IMedicalRecord>('MedicalRecords',medicalRecordSchema);
module.exports = medicalRecord;