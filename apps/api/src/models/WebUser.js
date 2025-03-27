const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  cognitoId: {
    type: String,
    required: true,
  },
  // email: {
  //   type: String,
  //   required: true,
  // },
  // password: {
  //   type: String,
  //   required: true,
  // },
  businessType: {
    type: String,
    required: true,
  },
  bussinessId: {
    type: String,
  },
  // status: {
  //   type: Number,
  //   default: 0,
  // },
  otp: {
    type: Number,
  },
  otpExpiry: {
    type: Date,
  },
});

const WebUser = mongoose.model('WebUser', UserSchema);

const ProfileDataSchema = new mongoose.Schema({
  userId: {
    type: String,
  },
  businessName: {
    type: String,
    required: true,
  },
  registrationNumber: {
    type: String,
    required: true,
  },
  yearOfEstablishment: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  website: {
    type: String,
    required: true,
  },
  address: {
    addressLine1: {
      type: String,
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    zipCode: {
      type: String,
      required: true,
    },
    latitude: {
      type: String,
      required: true,
    },
    longitude: {
      type: String,
      required: true,
    },
  },
  activeModes: {
    type: String,
  },
  selectedServices: {
    type: Array,
    required: true,
  },
  logo: {
    type: String,
    required: false,
  },

  prescription_upload: {
    type: [
      {
        name: { type: String, required: true },
        type: { type: String, required: true },
        date: { type: Date, default: Date.now },
      },
    ],
    default: [], // Ensures an empty array if no documents are provided
  },
});

const ProfileData = mongoose.model('ProfileData', ProfileDataSchema);

const HospitalProfileSchema = new mongoose.Schema({
  resourceType: { type: String, default: 'Organization' },

  identifier: [
    // Registration Number
    {
      system: { type: String, default: 'http://example.com/registration' },
      value: { type: String, required: true },
    },

    {
      system: { type: String, default: 'http://example.com/hospital-id' },
      value: { type: String, required: true },
    }, // Unique Hospital ID
  ],

  name: { type: String, required: true },

  extension: [
    {
      url: {
        type: String,
        default:
          'http://example.com/fhir/StructureDefinition/yearOfEstablishment',
      },
      valueString: { type: String, required: true },
    },
  ],

  telecom: [
    {
      system: { type: String, enum: ['phone', 'email', 'url'], required: true },
      value: { type: String, required: true }, // Stores the actual phone number
      use: {
        type: String,
        enum: ['work', 'home', 'mobile'],
        default: 'work',
      },
    },
  ],

  address: [
    {
      line: { type: [String], required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      // country: { type: String, required: true },
      geoLocation: {
        latitude: { type: String, required: true },
        longitude: { type: String, required: true },
      },
    },
    
  ],

  // Type of Organization (Hospital, Clinic, etc.)
  type: [
    {
      coding: [
        {
          system: {
            type: String,
            default: 'http://terminology.hl7.org/CodeSystem/organization-type',
          },
          code: { type: String, default: 'prov' },
          display: { type: String, default: 'Healthcare Provider' },
        },
      ],
    },
  ],

  // Specialized Departments (Yes/No)
  active: { type: Boolean, required: true },

  
  healthcareService: [
    {
      resourceType: { type: String, default: 'HealthcareService' },
      providedBy: { type: String, },
      type: 
        {
          coding: [
            {
              system: { type: String,  },
              code: { type: String,  },
              display: { type: String, },
            },
          ],
        },
    },
  ],
  

  logo: {
    contentType: { type: String, required: true }, // MIME type (e.g., "image/png")
    url: { type: String, required: true }, // Direct URL to the logo
    // title: { type: String, required: true }, // Logo name/title
    creation: { type: Date, default: Date.now }, // Upload timestamp
  },
  attachments: {
    type: [
      {
        title: { type: String, required: true }, // Name of the document (FHIR-compliant)
        contentType: { type: String, required: true }, // File type (e.g., "application/pdf")
        url: { type: String, required: true }, // Direct URL to the document
        creation: { type: Date, default: Date.now }, // Upload timestamp (FHIR: "creation")
      },
    ],
    default: [], // Ensures an empty array if no documents are provided
  },
});

const HospitalProfile = mongoose.model(
  'HospitalProfile',
  HospitalProfileSchema
);

// module.exports = HospitalProfile;
module.exports = { WebUser, ProfileData, HospitalProfile };
