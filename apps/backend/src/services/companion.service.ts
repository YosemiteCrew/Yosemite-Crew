import { Types } from 'mongoose'
import CompanionModel, {
    type CompanionDocument,
    type CompanionMongo,
} from '../models/companion'

import {
    fromCompanionRequestDTO,
    toCompanionResponseDTO,
    type CompanionRequestDTO,
    type Companion,
    type CompanionType,
    type Gender,
    type RecordStatus,
    type SourceType,
} from '@yosemite-crew/types'

import {
    ParentCompanionService,
    ParentCompanionServiceError,
} from './parent-companion.service'
import { ParentService } from './parent.service'
import { buildS3Key, moveFile } from 'src/middlewares/upload'
import logger from 'src/utils/logger'

export class CompanionServiceError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message)
        this.name = 'CompanionServiceError'
    }
}

/**
 * FHIR DTO → persistable Mongo object
 */
const toPersistable = (payload: CompanionRequestDTO): CompanionMongo => {
    const companion = fromCompanionRequestDTO(payload)

    return {
        name: companion.name,
        type: companion.type,
        breed: companion.breed ?? '',
        dateOfBirth: companion.dateOfBirth,
        gender: companion.gender,
        photoUrl: companion.photoUrl,
        currentWeight: companion.currentWeight,
        colour: companion.colour,
        allergy: companion.allergy,
        bloodGroup: companion.bloodGroup,
        isNeutered: companion.isneutered,
        ageWhenNeutered: companion.ageWhenNeutered,
        microchipNumber: companion.microchipNumber,
        passportNumber: companion.passportNumber,
        isInsured: companion.isInsured ?? false,
        insurance: companion.insurance ?? null,
        countryOfOrigin: companion.countryOfOrigin,
        source: companion.source,
        status: companion.status,
        physicalAttribute: companion.physicalAttribute,
        breedingInfo: companion.breedingInfo,
        medicalRecords: companion.medicalRecords,
        // isProfileComplete is set in service logic below
    }
}

/**
 * Mongo → Companion → FHIR DTO
 */
const toFHIR = (doc: CompanionDocument) => {
    const plain = doc.toObject() as CompanionMongo & {
        _id: Types.ObjectId
        createdAt?: Date
        updatedAt?: Date
    }

    const companion: Companion = {
        id: plain._id.toString(),
        name: plain.name,
        type: plain.type as CompanionType,
        breed: plain.breed ?? '',
        dateOfBirth: plain.dateOfBirth,
        gender: plain.gender as Gender,
        photoUrl: plain.photoUrl,
        currentWeight: plain.currentWeight,
        colour: plain.colour,
        allergy: plain.allergy,
        bloodGroup: plain.bloodGroup,
        isneutered: plain.isNeutered,
        ageWhenNeutered: plain.ageWhenNeutered,
        microchipNumber: plain.microchipNumber,
        passportNumber: plain.passportNumber,
        isInsured: plain.isInsured ?? false,
        insurance: plain.insurance ?? undefined,
        countryOfOrigin: plain.countryOfOrigin,
        source: plain.source as SourceType | undefined,
        status: plain.status as RecordStatus | undefined,
        physicalAttribute: plain.physicalAttribute,
        breedingInfo: plain.breedingInfo,
        medicalRecords: plain.medicalRecords,
        isProfileComplete: plain.isProfileComplete,
        createdAt: plain.createdAt!,
        updatedAt: plain.updatedAt!,
    }

    return toCompanionResponseDTO(companion)
}

/**
 * Required fields for profile completion
 */
const REQUIRED_PROFILE_FIELDS: (keyof CompanionMongo)[] = [
    'name',
    'type',
    'breed',
    'dateOfBirth',
    'gender',
    'status',
]

/**
 * Backend-only logic for determining if profile is complete
 */
const computeIsProfileComplete = (companion: Partial<CompanionMongo>): boolean => {
    return REQUIRED_PROFILE_FIELDS.every((field) => {
        const value = companion[field]
        return value !== undefined && value !== null && value !== ''
    })
}

type CompanionCreateContext = {
    authUserId?: string
    parentMongoId?: Types.ObjectId
}

export const CompanionService = {

    async create(payload: CompanionRequestDTO, context?: CompanionCreateContext) {
        if (!context) {
            throw new CompanionServiceError(
                "Parent context is required to create a companion.",
                400
            );
        }

        let parentMongoId: Types.ObjectId | null = null;

        // Mobile flow → use linkedUserId to get parent
        if (context.authUserId) {
            const parent = await ParentService.findByLinkedUserId(context.authUserId);

            if (!parent) {
                throw new CompanionServiceError(
                    "Parent record not found for authenticated user.",
                    403
                );
            }
            parentMongoId = parent._id;
        }

        // PMS flow → provided directly by PMS backend
        if (!parentMongoId && context.parentMongoId) {
            parentMongoId = context.parentMongoId;
        }

        // If still missing → invalid request
        if (!parentMongoId) {
            throw new CompanionServiceError(
                "Unable to determine parent for companion creation.",
                400
            );
        }
        const persistable = toPersistable(payload);
        persistable.isProfileComplete = computeIsProfileComplete(persistable);

        let document: CompanionDocument | null = null;

        try {
            document = await CompanionModel.create(persistable);

            await ParentCompanionService.linkParent({
                parentId: parentMongoId,
                companionId: document._id,
                role: "PRIMARY",
            });

            if(persistable.photoUrl) {
                const finalKey = buildS3Key('companion', document._id.toString(), 'image/jpg')
                const profileUrl = await moveFile(persistable.photoUrl, finalKey)
                document.photoUrl = profileUrl
                await document.save()
            }

            return { response: toFHIR(document) };

        } catch (error) {
            // rollback if linking fails
            if (document) {
                await CompanionModel.deleteOne({ _id: document._id });
            }

            if (error instanceof ParentCompanionServiceError) {
                throw new CompanionServiceError(error.message, error.statusCode);
            }

            throw error;
        }
    },

    async listByParent(parentId: Types.ObjectId) {
        const companionIds = await ParentCompanionService.getActiveCompanionIdsForParent(parentId)

        if (!companionIds.length) return { responses: [] }

        const documents = await CompanionModel.find({ _id: { $in: companionIds } })

        return { responses: documents.map(toFHIR) }
    },

    async getById(id: string) {
        if (!Types.ObjectId.isValid(id)) return null

        const document = await CompanionModel.findById(id)

        if (!document) return null

        return { response: toFHIR(document) }
    },

    async getByName(name: string){
        if (!name || typeof name !== "string") {
            throw new CompanionServiceError("Name is required for searching.", 400);
        }

        const searchRegex = new RegExp(name.trim(), "i");
        logger.info(`searchRegex: ${searchRegex}`)
        const documents = await CompanionModel.find({
            name: searchRegex,
        });

        return {
            responses: documents.map(toFHIR),
        };
    },

    /**
     * UPDATE companion (partial FHIR update)
     */
    async update(id: string, payload: CompanionRequestDTO) {
        if (!Types.ObjectId.isValid(id)) return null

        const persistable = toPersistable(payload)

        // Backend-only recomputation
        persistable.isProfileComplete = computeIsProfileComplete(persistable)

        const document = await CompanionModel.findByIdAndUpdate(
            id,
            { $set: persistable },
            { new: true, sanitizeFilter: true },
        )

        if (!document) return null

        return { response: toFHIR(document) }
    },

    /**
     * DELETE companion
     */
    async delete(id: string, context?: CompanionCreateContext) {
        if (!Types.ObjectId.isValid(id)) {
            throw new CompanionServiceError('Invalid companion identifier.', 400)
        }

        if (!context?.parentMongoId) {
            throw new CompanionServiceError('Parent context is required to delete a companion.', 400)
        }

        try {
            const document = await CompanionModel.findById(id)
            if (!document) {
                throw new CompanionServiceError('Companion not found.', 404)
            }

            // Ensure parent has permission
            await ParentCompanionService.ensurePrimaryOwnership(context.parentMongoId, document._id)

            // Remove links
            await ParentCompanionService.deleteLinksForCompanion(document._id)

            // Remove resource
            await CompanionModel.deleteOne({ _id: document._id })
        } catch (error) {
            if (error instanceof ParentCompanionServiceError) {
                throw new CompanionServiceError(error.message, error.statusCode)
            }
            throw error
        }
    },
}
