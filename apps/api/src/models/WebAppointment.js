const mongoose = require('mongoose');
const appointmentSchema = mongoose.Schema(
  {
    userId: {
      type: String,
    },
    tokenNumber: {
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

const AppointmentsTokenSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: String,
      required: true,
    },
    appointmentDate: {
      type: String, // Stored as 'YYYY-MM-DD'
      required: true,
    },
    tokenCounts: {
      type: Number,
      default: 0,
    },
    expireAt: {
      type: Date,
      default: function () {
        if (!this.appointmentDate) return undefined; // Prevent invalid date errors

        // Convert 'YYYY-MM-DD' string to Date and set to next day 12 AM
        const date = new Date(`${this.appointmentDate}T00:00:00.000Z`);

        if (isNaN(date.getTime())) {
          console.error('Invalid appointmentDate:', this.appointmentDate);
          return undefined; // Avoid setting an invalid date
        }

        date.setDate(date.getDate() + 1); // Move to next day at 00:00:00
        return date;
      },
      index: { expires: 0 }, // TTL index to auto-delete
    },
  },
  { timestamps: true }
);

const AppointmentsToken = mongoose.model(
  'AppointmentsToken',
  AppointmentsTokenSchema
);

module.exports = { AppointmentsToken, webAppointments };
