const mongoose = require('mongoose');
const appointmentSchema = mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    ownerName: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    addressline1: {
      type: String,
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    zipCode: {
      type: String,
      required: true,
    },
    petName: {
      type: String,
      required: true,
    },
    petAge: {
      type: String,
      required: true,
    },
    petType: {
      type: String,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },
    breed: {
      type: String,
    },
    purposeOfVisit: {
      type: String,
      required: true,
    },
    appointmentType: {
      type: String,
      required: true,
    },
    appointmentSource: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    veterinarian: {
      type: String,
      required: true,
    },
    appointmentDate: {
      type: String,
      required: true,
    },
    appointmentTime: {
      type: String,
      required: true,
    },
    appointmentTime24: {
      type: String,
      required: true,
    },
    day: {
      type: String,
      required: true,
    },
    slotsId: {
      type: String,
      required: true,
    },
    appointmentStatus: {
      type: Number,
      default: 0,
    },
    isCanceled: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);
const webAppointments = mongoose.model('webAppointment', appointmentSchema);
module.exports = webAppointments;
