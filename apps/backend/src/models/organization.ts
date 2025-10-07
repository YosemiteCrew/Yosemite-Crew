import { Schema, model, HydratedDocument } from 'mongoose'
import type { ToFHIROrganizationOptions } from '@yosemite-crew/types'

const ServiceSchema = new Schema(
    {
        name: { type: String },
        description: { type: String },
        estimatedCost: { type: Number },
        availability: { type: String },
        respnonseTime: { type: String },
    },
    { _id: false }
)

const DepartmentSchema = new Schema(
    {
        name: { type: String },
        services: { type: [ServiceSchema], default: undefined },
    },
    { _id: false }
)

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

export interface OrganizationMongo {
    fhirId?: string
    name: string
    registrationNo?: string
    imageURL?: string
    type?: string
    phoneNo?: string
    website?: string
    country?: string
    address?: {
        addressLine?: string
        country?: string
        city?: string
        state?: string
        postalCode?: string
        latitude?: number
        longitude?: number
    }
    departments?: Array<{
        name?: string
        services?: Array<{
            name?: string
            description?: string
            estimatedCost?: number
            availability?: string
            respnonseTime?: string
        }>
    }>
    isVerified?: boolean
    typeCoding?: ToFHIROrganizationOptions['typeCoding']
}

const OrganizationSchema = new Schema<OrganizationMongo>(
    {
        fhirId: { type: String },
        name: { type: String, required: true },
        registrationNo: { type: String },
        imageURL: { type: String },
        type: { type: String },
        phoneNo: { type: String },
        website: { type: String },
        country: { type: String },
        address: { type: AddressSchema },
        departments: { type: [DepartmentSchema], default: undefined },
        isVerified: { type: Boolean, default: false },
        typeCoding: {
            system: { type: String },
            code: { type: String },
            display: { type: String },
        },
    },
    {
        timestamps: true,
    }
)

export type OrganizationDocument = HydratedDocument<OrganizationMongo>

const OrganizationModel = model<OrganizationMongo>('Organization', OrganizationSchema)

export default OrganizationModel
