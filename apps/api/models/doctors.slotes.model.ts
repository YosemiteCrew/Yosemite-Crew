import { Schema, model } from 'mongoose';
import type { DoctorSlotDocument } from "@yosemite-crew/types";

const TimeSlotSchema = new Schema({
  time: { type: String, required: true },
  time24: { type: String, required: true },
  selected: { type: Boolean, default: false }
});

const DoctorSlotSchema = new Schema({
  doctorId: { type: String, required: true },
  day: { type: String, required: true },
  timeSlots: [TimeSlotSchema]
});

const DoctorsTimeSlotes = model<DoctorSlotDocument>('DoctorsTimeSlotes', DoctorSlotSchema);

export default DoctorsTimeSlotes;
