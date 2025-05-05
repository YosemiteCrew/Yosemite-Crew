const mongoose = require('mongoose');
const sharedSchema = new mongoose.Schema({

    petId: {
        type: Number,  
        required: true,
    },
    userId: {
        type: Number, 
        required: true,
    },
    ownerId: {
        type: Number, 
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
}, { timestamps: true});

const sharedRecord = mongoose.model('YoshSharedPetDuties',sharedSchema);

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
    profileImage:[
        {
            url: { type: String },
            originalname: { type: String },
            mimetype: { type: String }
        }
    ],
   
}, { timestamps: true});
const petCoOwner = mongoose.model('yosepetCoOwner',petCoOwnerSchema);
module.exports = { sharedRecord, petCoOwner };