import { Schema, Document, model, type HydratedDocument } from 'mongoose';
import { DayOfWeek } from './base-availability';

export interface OverrideSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface WeeklyOverrideDay {
  dayOfWeek: DayOfWeek;
  slots: OverrideSlot[];
}

export interface WeeklyAvailabilityOverrideMongo extends Document {
  userId: string;
  organisationId: string;
  weekStartDate: Date;
  overrides: WeeklyOverrideDay[];
  createdAt?: Date;
  updatedAt?: Date;
}

const WeeklyAvailabilityOverrideSchema = new Schema<WeeklyAvailabilityOverrideMongo>(
  {
    userId: { type: String, required: true },
    organisationId: { type: String, required: true },
    weekStartDate: { type: Date, required: true },
    overrides: [
      {
        dayOfWeek: String,
        slots: [
          {
            startTime: String,
            endTime: String,
            isAvailable: Boolean,
          },
        ],
      },
    ],
  },
  { timestamps: true }
);


WeeklyAvailabilityOverrideSchema.index({ userId: 1, organisationId: 1, weekStartDate: 1 }, { unique: true });

export type WeeklyAvailabilityOverrideDocument = HydratedDocument<WeeklyAvailabilityOverrideMongo>;

const WeeklyAvailabilityOverrideModel =
  model<WeeklyAvailabilityOverrideMongo>(
    'WeeklyAvailabilityOverride',
    WeeklyAvailabilityOverrideSchema
  );

export default WeeklyAvailabilityOverrideModel;
