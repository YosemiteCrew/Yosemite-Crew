const mongoose = require("mongoose");

const TimeSlotSchema = new mongoose.Schema({
  time: {
    type: String,
    required: true,
  },
  time24: {
    type: String,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
});

const DoctorSlotSchema = new mongoose.Schema({
  doctorId: {
    type: String,
    required: true,
  },
  day: {
    type: String,
    required: true,
  },
  timeSlots: [TimeSlotSchema],
});

const DoctorsTimeSlotes = mongoose.model("DoctorsTimeSlotes", DoctorSlotSchema);

module.exports = DoctorsTimeSlotes;
