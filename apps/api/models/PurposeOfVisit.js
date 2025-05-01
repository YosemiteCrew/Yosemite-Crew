const mongoose = require("mongoose");

const PurposeOfVisitSchema = mongoose.Schema({
    HospitalId:{
        type: String,
        required: true,
    },
    name:{
        type: String,
        required:true,
    }
})