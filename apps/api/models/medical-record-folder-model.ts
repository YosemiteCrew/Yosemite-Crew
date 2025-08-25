import mongoose from "mongoose";

const medicalRecordFolderSchema = new mongoose.Schema({
    folderName: {
        type: String,
    },
    folderUrl:{
        type: String,
    },
    petId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'pets'
    },
    medicalRecords: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MedicalRecords",
      },
    ],
}, {
    timestamps: true,
});
const  MedicalRecordFolderModel = mongoose.model("MedicalRecordFolder", medicalRecordFolderSchema);
export default MedicalRecordFolderModel;