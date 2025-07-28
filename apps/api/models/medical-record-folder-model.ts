import mongoose from "mongoose";

const medicalRecordFolderSchema = new mongoose.Schema({

    folderName: {
        type: String,
    },
    folderUrl:{
        type: String,
    }
    
}, {
    timestamps: true,
});
const MedicalRecordFolderModel = mongoose.model("MedicalRecordFolder", medicalRecordFolderSchema);
export default MedicalRecordFolderModel;