import mongoose, { Schema, Model } from 'mongoose';
import { AddDoctorDoc } from "@yosemite-crew/types";

const vetSchema: Schema<AddDoctorDoc> = new Schema(
  {
    userId: { type: String, required: true },
    // bussinessId: { type: String, required: true },

    registrationNumber: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String },
    mobileNumber: {
      type: String,
      match:
        /^\+?[0-9]{1,4}?[-.\\\s]?(\([0-9]{1,3}\)|[0-9]{1,4})?[-.\\\s]?[0-9]{1,4}[-.\\\s]?[0-9]{1,9}$/,
    },
    gender: { type: String },
    dateOfBirth: { type: String },
    linkedin: { type: String },
    medicalLicenseNumber: { type: String },
    yearsOfExperience: { type: Number },
    postalCode: { type: String }, // renamed from postalCode
    addressLine1: { type: String },
    city: { type: String },
    stateProvince: { type: String },
    biography: { type: String },
    duration: { type: String }, // newly added field
    area: { type: String }, // from `area`
    countrycode: { type: String, default: '+91' },

    specialization: {
      type: String,
      ref: 'Department',
    },

    image: { type: String },

    availability: [
      {
        day: {
          type: String,
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
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
  },
  { timestamps: true }
);

const AddDoctors: Model<AddDoctorDoc> = mongoose.model<AddDoctorDoc>('AddDoctors', vetSchema);
export default AddDoctors;
