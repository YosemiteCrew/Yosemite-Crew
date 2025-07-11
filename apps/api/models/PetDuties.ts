import mongoose from 'mongoose';

const sharedSchema = new mongoose.Schema({

    petId: {
        type: String,  
        required: true,
    },
    userId: {
        type: String, 
        required: true,
    },
    ownerId: {
        type: String, 
        required: true,
    },
    taskName: {
        type: String,
    },
    taskDate: {
        type: Date,
    },
    taskTime: {
        type: String,
    },
    repeatTask: {
        type: String,
    },
    taskReminder: {
        type: String,
    },
    syncWithCalendar: {
        type: Boolean,
        default: false
     },
}, { timestamps: true});

const sharedRecord = mongoose.model('SharedPetDuties',sharedSchema);

const petCoOwnerSchema = new mongoose.Schema({

    firstName: {
        type: String, 
    },
    lastName: {
        type: String,
    },
    relationToPetOwner:{
        type: String,
    },
    createdBy: {
        type: String,
    },
    profileImage:[
        {
            url: { type: String },
            originalname: { type: String },
            mimetype: { type: String }
        }
    ],
   
}, { timestamps: true});
const petCoOwner = mongoose.model('petCoOwner',petCoOwnerSchema);
module.exports = { sharedRecord, petCoOwner };