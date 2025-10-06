import { Request, Response } from 'express'
import type { UploadedFile as ExpressUploadedFile, FileArray } from 'express-fileupload'
import logger from '../../utils/logger'
import { ParentService, ParentServiceError } from '../../services/parent.service'
import type { ParentRequestDTO } from '../../../../../packages/types/src/dto/parent.dto'
import type { Attachment } from '../../../../../packages/fhirtypes/src/Attachment'
import { handleFileUpload, uploadBufferAsFile, type FileUploadResult } from '../../middelwares/upload'

const PROFILE_IMAGE_FIELD = 'profileImage'
const STORAGE_KEY_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/storage-key'
const INLINE_DATA_URL_PATTERN = /^data:([^;]+);base64,/i

const isFileArray = (value: ExpressUploadedFile | ExpressUploadedFile[] | undefined): value is ExpressUploadedFile[] =>
    Array.isArray(value)

const getSingleFile = (
    files: FileArray | undefined,
    fieldName: string
): ExpressUploadedFile | undefined => {
    if (!files) {
        return undefined
    }

    const file = files[fieldName]

    if (!file) {
        return undefined
    }

    return isFileArray(file) ? file[0] : file
}

const parseParentPayload = (payload: unknown): ParentRequestDTO | undefined => {
    if (!payload) {
        return undefined
    }

    if (typeof payload === 'string') {
        const trimmed = payload.trim()

        if (!trimmed) {
            return undefined
        }

        try {
            return JSON.parse(trimmed) as ParentRequestDTO
        } catch (error) {
            throw new ParentServiceError('Invalid JSON payload for parent.', 400)
        }
    }

    if (typeof payload === 'object') {
        return payload as ParentRequestDTO
    }

    return undefined
}

const extractParentPayload = (req: Request): ParentRequestDTO | undefined => {
    const body = req.body as Record<string, unknown> | undefined

    if (!body) {
        return undefined
    }

    const candidate = 'payload' in body ? body.payload : body
    return parseParentPayload(candidate)
}

const uploadProfileImage = async (file: ExpressUploadedFile): Promise<FileUploadResult> =>
    handleFileUpload(file, 'parent-profiles')

const parseInlinePhotoAttachment = (payload: ParentRequestDTO | undefined): Attachment | undefined => {
    return payload?.photo?.find((attachment) => typeof attachment?.data === 'string' && attachment.data.trim().length > 0)
}

const decodeInlinePhoto = (attachment: Attachment): { buffer: Buffer; mimeType: string; originalName?: string } => {
    const rawData = attachment.data?.trim()

    if (!rawData) {
        throw new ParentServiceError('Photo data is empty.', 400)
    }

    let base64Content = rawData
    let mimeType = attachment.contentType?.trim()

    const inlineMatch = rawData.match(INLINE_DATA_URL_PATTERN)

    if (inlineMatch) {
        mimeType = mimeType ?? inlineMatch[1]
        base64Content = rawData.replace(INLINE_DATA_URL_PATTERN, '')
    }

    if (!mimeType) {
        throw new ParentServiceError('Photo content type is required when providing inline data.', 400)
    }

    try {
        const buffer = Buffer.from(base64Content, 'base64')

        if (!buffer.length) {
            throw new Error('Decoded buffer is empty.')
        }

        return {
            buffer,
            mimeType,
            originalName: attachment.title,
        }
    } catch (error) {
        throw new ParentServiceError('Invalid base64 photo data.', 400)
    }
}

const removeStorageKeyExtension = (attachment: Pick<Attachment, 'extension'>) =>
    attachment.extension?.filter((item) => item?.url !== STORAGE_KEY_EXTENSION_URL)

const buildAttachmentWithUploadResult = (
    attachment: Partial<Attachment>,
    uploadResult: FileUploadResult,
    mimeType: string
): Attachment => {
    return {
        ...attachment,
        url: uploadResult.url,
        data: undefined,
        contentType: mimeType,
        title: attachment.title ?? uploadResult.originalname,
        extension: [
            ...(removeStorageKeyExtension(attachment as Pick<Attachment, 'extension'>) ?? []),
            {
                url: STORAGE_KEY_EXTENSION_URL,
                valueString: uploadResult.key,
            },
        ],
    }
}

export const ParentController = {
    create: async (req: Request, res: Response) => {
        try {
            const payload = extractParentPayload(req)

            if (!payload) {
                res.status(400).json({ message: 'Request body is required.' })
                return
            }

            const profileImageFile = getSingleFile(req.files, PROFILE_IMAGE_FIELD)

            if (profileImageFile) {
                const uploadResult = await uploadProfileImage(profileImageFile)

                payload.photo = [
                    buildAttachmentWithUploadResult(
                        { title: profileImageFile.name },
                        uploadResult,
                        profileImageFile.mimetype
                    ),
                ]
            } else {
                const inlineAttachment = parseInlinePhotoAttachment(payload)

                if (inlineAttachment) {
                    const { buffer, mimeType, originalName } = decodeInlinePhoto(inlineAttachment)
                    const uploadResult = await uploadBufferAsFile(buffer, {
                        folderName: 'parent-profiles',
                        mimeType,
                        originalName,
                    })

                    payload.photo = [
                        buildAttachmentWithUploadResult(inlineAttachment, uploadResult, mimeType),
                    ]
                }
            }

            const { response, isProfileComplete } = await ParentService.create(payload)
            res.set('x-parent-profile-complete', String(isProfileComplete))
            res.status(201).json(response)
        } catch (error) {
            if (error instanceof ParentServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to create parent', error)
            res.status(500).json({ message: 'Unable to create parent.' })
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params

            if (!id) {
                res.status(400).json({ message: 'Parent ID is required.' })
                return
            }

            const result = await ParentService.getById(id)

            if (!result) {
                res.status(404).json({ message: 'Parent not found.' })
                return
            }

            res.set('x-parent-profile-complete', String(result.isProfileComplete))
            res.status(200).json(result.response)
        } catch (error) {
            if (error instanceof ParentServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to retrieve parent', error)
            res.status(500).json({ message: 'Unable to retrieve parent.' })
        }
    },

    update: async (req: Request, res: Response) => {
        try {
            const { id } = req.params
            const payload = extractParentPayload(req)

            if (!id) {
                res.status(400).json({ message: 'Parent ID is required.' })
                return
            }

            if (!payload) {
                res.status(400).json({ message: 'Request body is required.' })
                return
            }

            payload.id = id

            const profileImageFile = getSingleFile(req.files, PROFILE_IMAGE_FIELD)

            if (profileImageFile) {
                const uploadResult = await uploadProfileImage(profileImageFile)

                payload.photo = [
                    buildAttachmentWithUploadResult(
                        { title: profileImageFile.name },
                        uploadResult,
                        profileImageFile.mimetype
                    ),
                ]
            } else {
                const inlineAttachment = parseInlinePhotoAttachment(payload)

                if (inlineAttachment) {
                    const { buffer, mimeType, originalName } = decodeInlinePhoto(inlineAttachment)
                    const uploadResult = await uploadBufferAsFile(buffer, {
                        folderName: 'parent-profiles',
                        mimeType,
                        originalName,
                    })

                    payload.photo = [
                        buildAttachmentWithUploadResult(inlineAttachment, uploadResult, mimeType),
                    ]
                }
            }

            const result = await ParentService.update(id, payload)

            if (!result) {
                res.status(404).json({ message: 'Parent not found.' })
                return
            }

            res.set('x-parent-profile-complete', String(result.isProfileComplete))
            res.status(200).json(result.response)
        } catch (error) {
            if (error instanceof ParentServiceError) {
                res.status(error.statusCode).json({ message: error.message })
                return
            }
            logger.error('Failed to update parent', error)
            res.status(500).json({ message: 'Unable to update parent.' })
        }
    },
}
