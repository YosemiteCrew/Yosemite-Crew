const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({

    userId: {
        type: Number,
        required: true,
    },
    hospitalId: {
        type: Number,
    },
    departmentId: {
        type: Number,
    },
    doctorId: {
        type: Number,
    },
    dayFor: {
        type: String,
    },
    timeFor: {
        type: String,
    },
    monthFor: {
        type: String,
    },
    appointmentDate: {
        type: Date,
    },
    document: {
        type: String,
    },
    message: {
        type: String,
    },
    appointmentStatus:{
        type: Number,
        default: 0 
    }

}, { timestamps: true});
const YoshAppointment = mongoose.model('YoshAppointment',appointmentSchema);
module.exports = YoshAppointment;
