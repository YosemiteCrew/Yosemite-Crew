import mongoose, {Schema, Model} from 'mongoose';
import type { medicalDoc, medicalRecord } from "@yosemite-crew/types";


const medicalDocSchema : Schema<medicalDoc>= new mongoose.Schema({
  url: { type: String },
  originalname: { type: String },
  mimetype: { type: String }
}, { _id: false });


const medicalRecordSchema : Schema<medicalRecord>= new mongoose.Schema({

    userId: {
        type: String, 
        required: true,
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

const medicalRecord : Model<medicalRecord> = mongoose.model<medicalRecord>('MedicalRecords',medicalRecordSchema);
export default medicalRecord;