import { Schema, model, HydratedDocument } from 'mongoose'

const SpecialitySchema = new Schema(
    {
        fhirId: { type: String },
        organisationId: { type: String, required: true, index: true },
        departmentMasterId: { type: String },
        name: { type: String, required: true },
        description: { type: String },
        headUserId: { type: String },
        headName: { type: String },
        headProfilePicUrl: { type: String },
        services: { type: [String], default: undefined },
        memberUserIds: { type: [String], default: undefined },
    },
    {
        timestamps: true,
    }
)

export interface SpecialityMongo {
    fhirId?: string
    organisationId: string
    departmentMasterId?: string
    name: string
    description?: string
    headUserId?: string
    headName?: string
    headProfilePicUrl?: string
    services?: string[]
    memberUserIds?: string[]
    createdAt?: Date
    updatedAt?: Date
}

export type SpecialityDocument = HydratedDocument<SpecialityMongo>

const SpecialityModel = model<SpecialityMongo>('Speciality', SpecialitySchema)

export default SpecialityModel
