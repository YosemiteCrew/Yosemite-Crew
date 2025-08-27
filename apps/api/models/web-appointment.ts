/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import mongoose, { Schema, Model, model } from 'mongoose';
import { AppointmentsTokenType, WebAppointmentType } from "@yosemite-crew/types";


const UploadRecordSchema = new Schema(
  {
    fileName: { type: String },
    fileType: { type: String },
    fileUrl: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);
const UploadRecordSchema2 = new Schema(
  {
    originalname: { type: String, },
    mimetype: { type: String, },
    url: { type: String, },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const WebAppointmentSchema = new Schema<WebAppointmentType>(
  {
    hospitalId: String,
    userId: String,
    petId: String,
    ownerId:String,
    tokenNumber: String,
    ownerName: String,
    petName: String,
    purposeOfVisit: { type: String, required: true },
    passportNumber: String,
    microChipNumber: String,
    appointmentType: String,
    appointmentSource: String,
    department: { type: String, required: true },
    veterinarian: { type: String, required: true },
    appointmentDate: { type: String, required: true },
    appointmentTime: { type: String, required: true },
    appointmentTime24: { type: String, required: true },
    day: { type: String, required: true },
    slotsId: { type: String, required: true },
    description: String,
    cancelReason: String,
    appointmentStatus: { type: String, default: "pending" },
    isCanceled: { type: String, default: "0" },
    cancelledBy: String,
    uploadRecords: [UploadRecordSchema || UploadRecordSchema2],
  },
  { timestamps: true }
);

const webAppointments: Model<WebAppointmentType> = mongoose.model<WebAppointmentType>(
  'webAppointment',
  WebAppointmentSchema
);

export { webAppointments };


const AppointmentsTokenSchema = new Schema<AppointmentsTokenType>(
  {
    hospitalId: {
      type: String,
      required: true,
    },
    appointmentDate: {
      type: String,
      required: true,
      validate: {
        validator: (value: string) => {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(value)) return false;
          const date = new Date(`${value}T00:00:00.000Z`);
          return !isNaN(date.getTime());
        },
        message: (props: { value: string }) =>
          `${props.value} is not a valid date in YYYY-MM-DD format!`,
      },
    },
    tokenCounts: {
      type: Number,
      default: 0,
    },
    expireAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Pre-save middleware to set expireAt based on appointmentDate
AppointmentsTokenSchema.pre('save', function (this: AppointmentsTokenType, next) {
  if (!this.appointmentDate || this.appointmentDate === null || this.appointmentDate === undefined || /^\s*$/.test(this.appointmentDate)) {
    console.error('appointmentDate is invalid in pre-save hook:', this.appointmentDate);
    this.expireAt = undefined;
    return next();
  }

  const date = new Date(`${this.appointmentDate}T00:00:00.000Z`);
  if (isNaN(date.getTime())) {
    console.error('Invalid appointmentDate in pre-save hook:', this.appointmentDate);
    this.expireAt = undefined;
    return next();
  }

  date.setDate(date.getDate() + 1);
  this.expireAt = date;
  next();
});

// Pre-update middleware to set expireAt during findOneAndUpdate
// eslint-disable-next-line @typescript-eslint/no-explicit-any
AppointmentsTokenSchema.pre('findOneAndUpdate', function (this: any, next) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update = this.getUpdate() as any;
  let appointmentDate = update.appointmentDate || this.getQuery().appointmentDate;

  if (update.$setOnInsert && update.$setOnInsert.appointmentDate) {
    appointmentDate = update.$setOnInsert.appointmentDate;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  if (!appointmentDate || /^\s*$/.test(appointmentDate)) {
    console.error('appointmentDate is invalid in findOneAndUpdate pre-hook:', appointmentDate);
    update.expireAt = undefined;
    this.set({ expireAt: undefined });
    return next();
  }

  const date = new Date(`${appointmentDate}T00:00:00.000Z`);
  if (isNaN(date.getTime())) {
    console.error('Invalid appointmentDate in findOneAndUpdate pre-hook:', appointmentDate);
    update.expireAt = undefined;
    this.set({ expireAt: undefined });
    return next();
  }

  date.setDate(date.getDate() + 1);
  update.expireAt = date;
  this.set({ expireAt: date });
  next();
});

// Create a TTL index to automatically delete documents after expireAt
AppointmentsTokenSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const AppointmentsToken: Model<AppointmentsTokenType> = model<AppointmentsTokenType>(
  'AppointmentsToken',
  AppointmentsTokenSchema
);


 export { AppointmentsToken };