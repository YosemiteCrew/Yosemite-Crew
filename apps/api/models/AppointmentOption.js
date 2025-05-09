const mongoose = require("mongoose");

const BreedsSchema = mongoose.Schema({
    name:{
        type: String,
        require:true
    },
    category:{
        type: String,
        required: true,
        enum: ["Dog", "Cat", "Horse"]
    }
})

const Breeds = mongoose.model("Breeds", BreedsSchema)


const PurposeOfVisitsSchema = mongoose.Schema({
    HospitalId:{
        type: String,
        required: true,
    },
    name:{
        type: String,
        required:true,
    }
})

const PurposeOfVisits = mongoose.model("PurposeOfVisits", PurposeOfVisitsSchema)

const AppointmentTypeSchema = mongoose.Schema({
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