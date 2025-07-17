import { Schema, Document, model } from 'mongoose';
 
export interface IDepartment extends Document {
  departmentName: string;
  bussinessId: string;
  description?: string;
  email: string;
  countrycode: string;
  phone: string;
  services: string[];
  departmentHeadId: string;
  consultationModes: ('In-person' | 'Online' | 'Both')[];
  conditionsTreated: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
 
const DepartmentSchema = new Schema<IDepartment>(
  {
    departmentName: { type: String, required: true },
    bussinessId: { type: String, required: true },
    description: { type: String },
    email: {
      type: String,
      required: true,
     match: /.+@.+\..+/
    },
    countrycode: { type: String, required: true },
    phone: {
      type: String,
      required: true,
      match: /^\+?[0-9]{1,4}?[-.\\\s]?(\([0-9]{1,3}\)|[0-9]{1,4})?[-.\\\s]?[0-9]{1,4}[-.\\\s]?[0-9]{1,9}$/,
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
    departmentHeadId: { type: String},
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
  },
  { timestamps: true }
);
 
const Department = model<IDepartment>('Department', DepartmentSchema);
export default Department;
 