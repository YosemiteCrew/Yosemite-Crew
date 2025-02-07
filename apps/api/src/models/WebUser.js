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
    type: String,
  },
});

const ProfileData = mongoose.model('ProfileData', ProfileDataSchema);

module.exports = { WebUser, ProfileData };
