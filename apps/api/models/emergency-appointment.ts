import { EmergencyAppointmentModel } from "@yosemite-crew/types";
import mongoose, { Model, Schema } from "mongoose";

const Appointment = new Schema<EmergencyAppointmentModel>(
  {
    userId: String,
    hospitalId: String,
    tokenNumber: String,
    ownerName: String,
    petName: String,
    department: { type: String, required: true },
    veterinarian: { type: String, required: true },
    cancelReason: {type:String,default:""},
    appointmentStatus: { type: String, default: "pending" },
    isCanceled: { type: String, default: "0" },
    cancelledBy: {type:String, default:""},
    petType: String,
    petBreed: String,
    gender: String,
    phoneNumber: Number,
    email: String,
    appointmentTime: String,
    appointmentDate: String,
  },
  { timestamps: true }
);

const emergencyAppointment: Model<EmergencyAppointmentModel> =
  mongoose.model<EmergencyAppointmentModel>(
    "emergencyAppointment",
    Appointment
  );

export { emergencyAppointment };
