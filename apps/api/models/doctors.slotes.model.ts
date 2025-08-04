import mongoose, { Schema, model } from 'mongoose';
import type { DoctorSlotDocument, IUnavailableSlot } from "@yosemite-crew/types";

const TimeSlotSchema = new Schema({
  time: { type: String, required: true },
  time24: { type: String, required: true },
  selected: { type: Boolean, default: false }
});

const DoctorSlotSchema = new Schema({
  doctorId: { type: String, required: true },
  duration: { type: String, required: true }, // Duration in minutes
  day: { type: String, required: true },
  timeSlots: [TimeSlotSchema]
});

const DoctorsTimeSlotes = model<DoctorSlotDocument>('DoctorsTimeSlotes', DoctorSlotSchema);

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Unavailable Slot Schema >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// This schema is used to store unavailable slots for doctors

const UnavailableSlotSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    day: {
      type: String,
      required: true,
    },
    slots: {
      type: [String],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const UnavailableSlot = mongoose.model<IUnavailableSlot>(
  "UnavailableSlot",
  UnavailableSlotSchema
);


export  { DoctorsTimeSlotes, UnavailableSlot };