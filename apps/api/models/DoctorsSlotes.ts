import mongoose, { Schema, Model } from 'mongoose';
import type { timeSlot, doctorSlot } from "@yosemite-crew/types";


const TimeSlotSchema : Schema<timeSlot> = new mongoose.Schema({
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

const DoctorSlotSchema : Schema<doctorSlot>  = new mongoose.Schema({
  doctorId: {
    type: String,
    required: true,
    // ref:"adddoctors"
  },
  day: {
    type: String,
    required: true,
  },
  timeSlots: [TimeSlotSchema],
});

const DoctorsTimeSlotes : Model<doctorSlot> = mongoose.model<doctorSlot>("DoctorsTimeSlotes", DoctorSlotSchema);

module.exports = DoctorsTimeSlotes;
