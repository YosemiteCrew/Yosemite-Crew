import { HydratedDocument, Schema, model } from 'mongoose'

export interface CompanionMongo {
    fhirId?: string
    name: string
    type: string
    breed?: string
    dateOfBirth: Date
    gender: string
    photoUrl?: string
    currentWeight?: number
    colour?: string
    allergy?: string
    bloodGroup?: string
    isNeutered?: boolean
    ageWhenNeutered?: string
    microchipNumber?: string
    passportNumber?: string
    isInsured: boolean
    insurance?: Record<string, unknown> | null
    countryOfOrigin?: string
    source?: string
    status?: string
    createdAt?: Date
    updatedAt?: Date
}

const CompanionSchema = new Schema<CompanionMongo>(
    {
        fhirId: { type: String },
        name: { type: String, required: true },
        type: { type: String, required: true },
        breed: { type: String },
        dateOfBirth: { type: Date, required: true },
        gender: { type: String, required: true },
        photoUrl: { type: String },
        currentWeight: { type: Number },
        colour: { type: String },
        allergy: { type: String },
        bloodGroup: { type: String },
        isNeutered: { type: Boolean },
        ageWhenNeutered: { type: String },
        microchipNumber: { type: String },
        passportNumber: { type: String },
        isInsured: { type: Boolean, required: true, default: false },
        insurance: { type: Schema.Types.Mixed, default: null },
        countryOfOrigin: { type: String },
        source: { type: String },
        status: { type: String },
    },
    {
        timestamps: true,
    }
)

export type CompanionDocument = HydratedDocument<CompanionMongo>

const CompanionModel = model<CompanionMongo>('Companion', CompanionSchema)

export default CompanionModel
