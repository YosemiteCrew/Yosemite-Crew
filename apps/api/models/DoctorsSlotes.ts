import mongoose, { Schema, Model } from 'mongoose';
import type { ITimeSlot, IDoctorSlot } from "@yosemite-crew/types";


const TimeSlotSchema : Schema<ITimeSlot> = new mongoose.Schema({
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

const DoctorSlotSchema : Schema<IDoctorSlot>  = new mongoose.Schema({
  doctorId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref:"adddoctors"
  },
  day: {
    type: String,
    required: true,
  },
  timeSlots: [TimeSlotSchema],
});

const DoctorsTimeSlotes : Model<IDoctorSlot> = mongoose.model<IDoctorSlot>("DoctorsTimeSlotes", DoctorSlotSchema);

module.exports = DoctorsTimeSlotes;
