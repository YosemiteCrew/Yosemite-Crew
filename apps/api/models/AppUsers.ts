import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({

    cognitoId: {
        type: String, 
    },
    email: {
        type: String, 
    },
    password: {
        type: Array,
    },
    otp: { 
        type: Number,
    },
    otpExpiry: { 
        type: Date, 
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
    },
    mobilePhone: {
        type: String,
    },
    countryCode:{
        type: String,
    },
    city: {
        type: String,
    },
    zipcode: {
        type: String,
    },
    
    isProfessional: {
        type: String,
    },
    isConfirmed: {
        type: Boolean,
        default: false,
    },
    professionType: {
        type: Array,
    },
    pimsCode: {
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

const appUsers = mongoose.model('appUsers',userSchema);
 export default appUsers;