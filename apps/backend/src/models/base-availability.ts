import { Schema, model, type HydratedDocument } from 'mongoose'

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface AvailabilitySlotMongo {
    startTime: string
    endTime: string
    isAvailable: boolean
}

export interface BaseAvailabilityMongo {
    userId: string
    organisationId?: string
    dayOfWeek: DayOfWeek
    slots: AvailabilitySlotMongo[]
    createdAt?: Date
    updatedAt?: Date
}

const AvailabilitySlotSchema = new Schema<AvailabilitySlotMongo>(
    {
        startTime: { type: String, required: true, trim: true },
        endTime: { type: String, required: true, trim: true },
        isAvailable: { type: Boolean, default: true },
    },
    { _id: false }
)

const BaseAvailabilitySchema = new Schema<BaseAvailabilityMongo>(
    {
        userId: { type: String, required: true, trim: true, index: true },
        organisationId: { type: String, required: true },
        dayOfWeek: { type: String, required: true},
        slots: { type: [AvailabilitySlotSchema], default: [] },
    },
    {
        timestamps: true,
    }
)

BaseAvailabilitySchema.index({ userId: 1, organisationId: 1, dayOfWeek: 1 }, { unique: true })

export type BaseAvailabilityDocument = HydratedDocument<BaseAvailabilityMongo>

const BaseAvailabilityModel = model<BaseAvailabilityMongo>('BaseAvailability', BaseAvailabilitySchema)

export default BaseAvailabilityModel
