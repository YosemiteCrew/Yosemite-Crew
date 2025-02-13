const mongoose = require('mongoose');
const appointmentSchema = mongoose.Schema(
  {
    userId: {
      type: String,
    
    },
    ownerName: {
      type: String,
     
    },
    phone: {
      type: String,
     
    },
    addressline1: {
      type: String,
    
    },
    street: {
      type: String,
      
    },
    city: {
      type: String,
     
    },
    state: {
      type: String,
      
    },
    zipCode: {
      type: String,
      
    },
    petId: {
      type: String,
    },
    petName: {
      type: String,
     
    },
    petAge: {
      type: String,
     
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
    concernOfVisit: {
      type: String,
    },
    appointmentType: {
      type: String,
    },
    appointmentSource: {
      type: String,
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
    hospitalId: {
      type: String,
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
    document: {
      type: [String],
    },
  },
  { timestamps: true }
);
const webAppointments = mongoose.model('webAppointment', appointmentSchema);
module.exports = webAppointments;
