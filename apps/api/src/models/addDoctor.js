const mongoose = require('mongoose');

const vetSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
    },
    personalInfo: {
      image: { type: String },
      firstName: { type: String },
      lastName: { type: String },
      gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
      },
      dateOfBirth: { type: String },
      email: { type: String },
      phone: {
        type: String,

        match:
          /^\+?[0-9]{1,4}?[-.\\\s]?(\([0-9]{1,3}\)|[0-9]{1,4})?[-.\\\s]?[0-9]{1,4}[-.\\\s]?[0-9]{1,9}$/,
      },
    },
    residentialAddress: {
      addressLine1: { type: String },
      city: { type: String },
      stateProvince: { type: String },
      country: { type: String },
      zipCode: { type: String },
    },
    professionalBackground: {
      specialization: {
        type: String,
        ref: 'Department',
      },
      qualification: { type: String },
      medicalLicenseNumber: { type: String },
      yearsOfExperience: { type: Number },
      languagesSpoken: { type: String },
      biography: { type: String, required: false },
      image: { type: String },
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
              hour: {
                type: String,
              },
              minute: {
                type: String,
              },
              period: {
                type: String,
                enum: ['AM', 'PM'],
              },
            },
            to: {
              hour: {
                type: String,
              },
              minute: {
                type: String,
              },
              period: {
                type: String,
                enum: ['AM', 'PM'],
              },
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
      default: [], // Ensures an empty array if no documents are provided
    },
    timeDuration: {
      type: Number,
    },
    activeModes: {
      type: [String],
      enum: ['In-person', 'Online', 'Both'],
    },
    consultFee: { type: Number },
    DoctorPrescriptions: {
      type: String,
    },
    authSettings: {
      takeAssessments: { type: Boolean },
      // allowVideoCalls: { type: Boolean,  },
      appointments: { type: Boolean },
      viewMedicalRecords: { type: Boolean },
      prescribeMedications: { type: Boolean },
    },
    termsAndConditions: { type: Boolean },
  },
  { timestamps: true }
);

const AddDoctors = mongoose.model('AddDoctors', vetSchema);
module.exports = AddDoctors;
