import { HydratedDocument, Schema, model } from 'mongoose'

const AddressSchema = new Schema(
    {
        addressLine: { type: String },
        country: { type: String },
        city: { type: String },
        state: { type: String },
        postalCode: { type: String },
        latitude: { type: Number },
        longitude: { type: Number },
    },
    { _id: false }
)

export interface ParentMongo {
    fhirId?: string
    firstName: string
    lastName?: string
    age: number
    address: {
        addressLine?: string
        country?: string
        city?: string
        state?: string
        postalCode?: string
        latitude?: number
        longitude?: number
    }
    phoneNumber?: string
    profileImageUrl?: string
}

const ParentSchema = new Schema<ParentMongo>(
    {
        fhirId: { type: String },
        firstName: { type: String, required: true },
        lastName: { type: String },
        age: { type: Number, required: true },
        address: { type: AddressSchema, required: true },
        phoneNumber: { type: String },
        profileImageUrl: { type: String },
    },
    {
        timestamps: true,
    }
)

export type ParentDocument = HydratedDocument<ParentMongo>

const ParentModel = model<ParentMongo>('Parent', ParentSchema)

export default ParentModel
