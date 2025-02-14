const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  departmentName: {
    type: String,
    required: true,
  },
  bussinessId: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  email: {
    type: String,
    required: true,
    match: /.+\@.+\..+/,
  },
  countrycode: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    match:
      /^\+?[0-9]{1,4}?[-.\\\s]?(\([0-9]{1,3}\)|[0-9]{1,4})?[-.\\\s]?[0-9]{1,4}[-.\\\s]?[0-9]{1,9}$/,
  },
  services: [
    {
      type: String,
      enum: [
        'Cardiac Health Screenings',
        'Echocardiograms',
        'Electrocardiograms (ECG)',
        'Blood Pressure Monitoring',
        'Holter Monitoring',
        'Cardiac Catheterization',
        'Congenital Heart Disease Management',
      ],
    },
  ],
  departmentHeadId: {
    // type: mongoose.Schema.Types.ObjectId,
    // ref: "User",
    type: String,
    required: true,
  },
  // operatingHours: [
  //   {
  //     day: {
  //       type: String,
  //       enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  //       required: true,
  //     },
  //     times: [
  //       {
  //         from: {
  //           hour: {
  //             type: String,
  //             required: true,
  //           },
  //           minute: {
  //             type: String,
  //             required: true,
  //           },
  //           period: {
  //             type: String,
  //             enum: ["AM", "PM"],
  //             required: true,
  //           },
  //         },
  //         to: {
  //           hour: {
  //             type: String,
  //             required: true,
  //           },
  //           minute: {
  //             type: String,
  //             required: true,
  //           },
  //           period: {
  //             type: String,
  //             enum: ["AM", "PM"],
  //             required: true,
  //           },
  //         },
  //       },
  //     ],
  //   },
  // ],
  consultationModes: {
    type: [String],
    enum: ['In-person', 'Online', 'Both'],
    required: true,
  },
  conditionsTreated: [
    {
      type: String,
      enum: [
        'Congestive Heart Failure',
        'Arrhythmias',
        'Heart Murmurs',
        'Dilated Cardiomyopathy',
        'Valvular Heart Disease',
        'Pericardial Effusion',
        'Myocarditis',
      ],
    },
  ],
});

const Department = mongoose.model('Department', DepartmentSchema);
module.exports = Department;
