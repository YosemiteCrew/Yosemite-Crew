import mongoose from 'mongoose';

const BreedsSchema = new mongoose.Schema({
    name:{
        type: String,
        required:true
    },
    category:{
        type: String,
        required: true,
        enum: ["Dog", "Cat", "Horse"]
    }
})

const Breeds = mongoose.model("Breeds", BreedsSchema)


const PurposeOfVisitsSchema = new mongoose.Schema({
    HospitalId:{
        type: String,
        required: true,
    },
    name:{
        type: String,
        required:true,
    }
})

const PurposeOfVisits =  mongoose.model("PurposeOfVisits", PurposeOfVisitsSchema)

const AppointmentTypeSchema = new mongoose.Schema({
    HospitalId:{
        type:String,
        required: true,
    },
    name:{
        type:String,
        required:true
    },
    category:{
        type:String,
        enum:["Dog", "Horse", "Cat",],
        required:true
    },
})

const AppointmentType = mongoose.model("AppointmentTypes",AppointmentTypeSchema)
module.exports = {Breeds,PurposeOfVisits,AppointmentType}