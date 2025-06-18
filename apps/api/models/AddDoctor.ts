import mongoose, { Schema, Model } from 'mongoose';
import {AddDoctorDoc} from "@yosemite-crew/types";

const vetSchema: Schema<AddDoctorDoc> = new Schema(
  {
    userId: { type: String, required: true },
    bussinessId: { type: String, required: true },
    personalInfo: {
      image: String,
      firstName: String,
      lastName: String,
      gender: String,
      dateOfBirth: String,
      email: String,
      countrycode: String,
      phone: {
        type: String,
        match:
          /^\+?[0-9]{1,4}?[-.\\\s]?(\([0-9]{1,3}\)|[0-9]{1,4})?[-.\\\s]?[0-9]{1,4}[-.\\\s]?[0-9]{1,9}$/,
      },
    },
    residentialAddress: {
      addressLine1: String,
      city: String,
      stateProvince: String,
      country: String,
      zipCode: String,
    },
    professionalBackground: {
      specialization: {
        type: String,
        ref: 'Department',
      },
      qualification: String,
      medicalLicenseNumber: String,
      yearsOfExperience: Number,
      languagesSpoken: String,
      biography: String,
      image: String,
    },
    availability: [
      {
        day: {
          type: String,
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
        times: [
          {
            from: {
              hour: String,
              minute: String,
              period: { type: String, enum: ['AM', 'PM'] },
            },
            to: {
              hour: String,
              minute: String,
              period: { type: String, enum: ['AM', 'PM'] },
            },
          },
        ],
      },
    ],
    documents: {
      type: [
        {
          name: { type: String, required: true },
          type: { type: String, required: true },
          date: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    cvFile: {
      name: { type: String, required: true },
      type: { type: String, required: true },
      date: { type: Date, default: Date.now },
    },
    timeDuration: Number,
    activeModes: {
      type: [String],
      enum: ['In-person', 'Online', 'Both'],
    },
    isAvailable: {
      type: String,
      default: '0',
    },
    consultFee: Number,
    DoctorPrescriptions: String,
    authSettings: {
      takeAssessments: Boolean,
      appointments: Boolean,
      viewMedicalRecords: Boolean,
      prescribeMedications: Boolean,
    },
    termsAndConditions: Boolean,
  },
  { timestamps: true }
);

const AddDoctors: Model<AddDoctorDoc> = mongoose.model<AddDoctorDoc>('AddDoctors', vetSchema);
export default AddDoctors;
