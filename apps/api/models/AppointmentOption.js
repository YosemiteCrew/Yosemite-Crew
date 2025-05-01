const mongoose = require("mongoose");

const BreedsSchema = mongoose.Schema({
    HospitalId:{
        type: String,
    },
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
module.exports = Breeds