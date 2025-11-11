import { Schema, model, HydratedDocument } from 'mongoose'
import type { ToFHIROrganizationOptions } from '@yosemite-crew/types'

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
    taxId: string
    DUNSNumber?: string
    imageURL?: string
    type: 'HOSPITAL' | 'BREEDER' | 'BOARDER' | 'GROOMER'
    phoneNo: string
    website?: string
    address: {
        addressLine?: string
        country?: string
        city?: string
        state?: string
        postalCode?: string
        latitude?: number
        longitude?: number
    }
    isVerified: boolean
    isActive: boolean
    typeCoding?: ToFHIROrganizationOptions['typeCoding']
    healthAndSafetyCertNo?: string
    animalWelfareComplianceCertNo?: string
    fireAndEmergencyCertNo?: string
}

const OrganizationSchema = new Schema<OrganizationMongo>(
    {
        fhirId: { type: String },
        name: { type: String, required: true },
        taxId: { type: String, required: true },
        DUNSNumber: { type: String },
        imageURL: { type: String },
        type: {
            type: String,
            enum: ['HOSPITAL', 'BREEDER', 'BOARDER', 'GROOMER'],
            required: true,
        },
        phoneNo: { type: String, required: true },
        website: { type: String },
        address: { type: AddressSchema, required: true },
        isVerified: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        healthAndSafetyCertNo: { type: String },
        animalWelfareComplianceCertNo: { type: String },
        fireAndEmergencyCertNo: { type: String },
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
