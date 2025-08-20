import mongoose from "mongoose";

const medicalRecordFolderSchema = new mongoose.Schema({

    folderName: {
        type: String,
    },
    folderUrl:{
        type: String,
    },
    petId:{
        type: mongoose.Schema.Types.ObjectId
    },
    uploadedFiles:[ 
        {
        url: { type: String},
        originalName: { type: String},
        mimetype: { type: String}
    }
]
}, {
    timestamps: true,
});
const MedicalRecordFolderModel = mongoose.model("MedicalRecordFolder", medicalRecordFolderSchema);
export default MedicalRecordFolderModel;