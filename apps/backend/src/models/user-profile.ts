import { Schema, model, type HydratedDocument } from 'mongoose'
import type { UserProfile as UserProfileType } from '@yosemite-crew/types'

export interface UserProfileAddressMongo {
    addressLine?: string
    country?: string
    city?: string
    state?: string
    postalCode?: string
    latitude?: number
    longitude?: number
}

export interface UserProfilePersonalDetailsMongo {
    gender?: 'MALE' | 'FEMALE' | 'OTHER'
    dateOfBirth?: Date
    employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT'
    address?: UserProfileAddressMongo
    phoneNumber?: string
    profilePictureUrl?: string
}

export interface UserProfileDocumentMongo {
    type: 'LICENSE' | 'CERTIFICATE' | 'CV' | 'OTHER'
    fileUrl: string
    uploadedAt: Date
    verified?: boolean
}

export interface UserProfileProfessionalDetailsMongo {
    medicalLicenseNumber?: string
    yearsOfExperience?: number
    specialization?: string
    qualification?: string
    biography?: string
    linkedin?: string
    documents?: UserProfileDocumentMongo[]
}

export type UserProfileMongo = Omit<UserProfileType, '_id' | 'personalDetails' | 'professionalDetails'> & {
    personalDetails?: UserProfilePersonalDetailsMongo
    professionalDetails?: UserProfileProfessionalDetailsMongo
}

const AddressSchema = new Schema<UserProfileAddressMongo>(
    {
        addressLine: { type: String, trim: true },
        country: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        postalCode: { type: String, trim: true },
        latitude: { type: Number },
        longitude: { type: Number },
    },
    { _id: false }
)

const PersonalDetailsSchema = new Schema<UserProfilePersonalDetailsMongo>(
    {
        gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], trim: true },
        dateOfBirth: { type: Date },
        employmentType: { type: String, enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT'], trim: true },
        address: { type: AddressSchema },
        phoneNumber: { type: String, trim: true },
        profilePictureUrl: { type: String, trim: true },
    },
    { _id: false }
)

const UserDocumentSchema = new Schema<UserProfileDocumentMongo>(
    {
        type: { type: String, enum: ['LICENSE', 'CERTIFICATE', 'CV', 'OTHER'], required: true },
        fileUrl: { type: String, required: true, trim: true },
        uploadedAt: { type: Date, required: true },
        verified: { type: Boolean },
    },
    { _id: false }
)

const ProfessionalDetailsSchema = new Schema<UserProfileProfessionalDetailsMongo>(
    {
        medicalLicenseNumber: { type: String, trim: true },
        yearsOfExperience: { type: Number },
        specialization: { type: String, trim: true },
        qualification: { type: String, trim: true },
        biography: { type: String, trim: true },
        linkedin: { type: String, trim: true },
        documents: { type: [UserDocumentSchema], default: undefined },
    },
    { _id: false }
)

const UserProfileSchema = new Schema<UserProfileMongo>(
    {
        userId: { type: String, required: true, trim: true },
        organizationId: { type: String, required: true, trim: true },
        personalDetails: { type: PersonalDetailsSchema },
        professionalDetails: { type: ProfessionalDetailsSchema },
        status: { type: String, enum: ['DRAFT', 'COMPLETED'], default: 'DRAFT', trim: true },
    },
    {
        timestamps: true,
    }
)

UserProfileSchema.index({ userId: 1, organizationId: 1 }, { unique: true })

export type UserProfileDocument = HydratedDocument<UserProfileMongo>

const UserProfileModel = model<UserProfileMongo>('UserProfile', UserProfileSchema)

export default UserProfileModel
