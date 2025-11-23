import { Types } from 'mongoose'

// Mock external modules before importing the service under test
jest.mock('../../src/models/organisationInvite', () => ({
    __esModule: true,
    default: {
        createOrReplaceInvite: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
    },
}))

jest.mock('../../src/models/organization', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
    },
}))

jest.mock('../../src/models/speciality', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        updateOne: jest.fn(),
    },
}))

jest.mock('../../src/services/user-organization.service', () => ({
    UserOrganizationService: { createUserOrganizationMapping: jest.fn() },
}))

jest.mock('../../src/utils/email-templates', () => ({
    renderOrganisationInviteTemplate: jest.fn(() => ({
        subject: 'You are invited',
        htmlBody: '<p>invite</p>',
        textBody: 'invite',
    })),
}))

jest.mock('../../src/utils/email', () => ({
    sendEmail: jest.fn(),
}))

import OrganisationInviteModel from '../../src/models/organisationInvite'
import OrganizationModel from '../../src/models/organization'
import SpecialityModel from '../../src/models/speciality'
import { UserOrganizationService } from '../../src/services/user-organization.service'
import { renderOrganisationInviteTemplate } from '../../src/utils/email-templates'
import { sendEmail } from '../../src/utils/email'

import { OrganisationInviteService } from '../../src/services/organisation-invite.service'

const mockedInviteModel = OrganisationInviteModel as unknown as {
    createOrReplaceInvite: jest.Mock
    findOne: jest.Mock
    find: jest.Mock
}

const mockedOrgModel = OrganizationModel as unknown as { findOne: jest.Mock }
const mockedSpecialityModel = SpecialityModel as unknown as { findOne: jest.Mock; updateOne: jest.Mock }
const mockedUserOrg = UserOrganizationService as unknown as { createUserOrganizationMapping: jest.Mock }
const mockedSendEmail = sendEmail as jest.Mock

const createMockInvite = (overrides: Partial<any> = {}) => {
    const _id = new Types.ObjectId()
    const base = {
        _id,
        organisationId: 'org-1',
        departmentId: 'dept-1',
        invitedByUserId: 'user-1',
        inviteeEmail: 'invitee@example.com',
        inviteeName: 'Invitee Name',
        role: 'ADMIN',
        employmentType: 'FULL_TIME',
        token: 'token-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        acceptedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
        toObject() {
            const { save, toObject, ...rest } = this as any
            return rest
        },
    }

    return Object.assign(base, overrides)
}

describe('OrganisationInviteService', () => {
    beforeEach(() => {
        // keep mock implementations provided by top-level jest.mock calls,
        // but clear call history between tests
        jest.clearAllMocks()
    })

    describe('createInvite', () => {
        it('creates invite and sends email', async () => {
            const org = { _id: new Types.ObjectId(), name: 'Org Name' }
            const dept = { _id: new Types.ObjectId() }
            const invite = createMockInvite()

            mockedOrgModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(org) }))
            mockedSpecialityModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(dept) }))
            mockedInviteModel.createOrReplaceInvite.mockResolvedValueOnce(invite)
            mockedSendEmail.mockResolvedValueOnce(undefined)

            const payload = {
                organisationId: org._id.toString(),
                departmentId: dept._id.toString(),
                invitedByUserId: 'user-1',
                inviteeEmail: 'Invitee@Example.COM',
                inviteeName: 'Invitee Name',
                role: 'ADMIN',
                employmentType: 'FULL_TIME',
            }

            const result = await OrganisationInviteService.createInvite(payload as any)

            expect(mockedInviteModel.createOrReplaceInvite).toHaveBeenCalled()
            expect(mockedSendEmail).toHaveBeenCalled()
            expect(result).toHaveProperty('_id')
            expect(result.inviteeEmail).toBe('invitee@example.com')
        })

        it('throws when sending email fails', async () => {
            const org = { _id: new Types.ObjectId(), name: 'Org Name' }
            const dept = { _id: new Types.ObjectId() }
            const invite = createMockInvite()

            mockedOrgModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(org) }))
            mockedSpecialityModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(dept) }))
            mockedInviteModel.createOrReplaceInvite.mockResolvedValueOnce(invite)
            mockedSendEmail.mockRejectedValueOnce(new Error('SMTP error'))

            const payload = {
                organisationId: org._id.toString(),
                departmentId: dept._id.toString(),
                invitedByUserId: 'user-1',
                inviteeEmail: 'invitee@example.com',
                inviteeName: 'Invitee Name',
                role: 'ADMIN',
                employmentType: 'FULL_TIME',
            }

            await expect(OrganisationInviteService.createInvite(payload as any)).rejects.toMatchObject({
                message: 'Unable to send organisation invite email.',
            })
        })
    })

    describe('listOrganisationInvites', () => {
        it('lists invites for organisation', async () => {
            const orgId = new Types.ObjectId().toString()
            const invite = createMockInvite()
            mockedOrgModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve({ _id: orgId }) }))
            // mock chain: find().sort().setOptions()
            mockedInviteModel.find.mockImplementationOnce(() => ({ sort: () => ({ setOptions: () => Promise.resolve([invite]) }) }))

            const results = await OrganisationInviteService.listOrganisationInvites(orgId)

            expect(Array.isArray(results)).toBe(true)
            expect(results[0]).toHaveProperty('_id')
        })
    })

    describe('acceptInvite', () => {
        it('accepts invite and adds user to organisation and department', async () => {
            const invite = createMockInvite()
            const org = { _id: new Types.ObjectId(), name: 'Org Name' }
            const dept = { _id: new Types.ObjectId() }

            mockedInviteModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(invite) }))
            mockedOrgModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(org) }))
            mockedSpecialityModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(dept) }))
            mockedUserOrg.createUserOrganizationMapping.mockResolvedValueOnce(undefined)
            mockedSpecialityModel.updateOne.mockResolvedValueOnce({})

            const result = await OrganisationInviteService.acceptInvite({
                token: invite.token,
                userId: 'user-42',
                userEmail: invite.inviteeEmail,
            })

            expect(invite.save).toHaveBeenCalled()
            expect(mockedUserOrg.createUserOrganizationMapping).toHaveBeenCalled()
            expect(mockedSpecialityModel.updateOne).toHaveBeenCalled()
            expect(result).toHaveProperty('_id')
        })

        it('throws when invitation not found', async () => {
            mockedInviteModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(null) }))

            await expect(
                OrganisationInviteService.acceptInvite({ token: 'nope', userId: 'u', userEmail: 'a@b.com' })
            ).rejects.toMatchObject({ message: 'Invitation not found.' })
        })

        it('throws when invite already accepted', async () => {
            const invite = createMockInvite({ status: 'ACCEPTED' })
            mockedInviteModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(invite) }))

            await expect(
                OrganisationInviteService.acceptInvite({ token: invite.token, userId: 'u', userEmail: invite.inviteeEmail })
            ).rejects.toMatchObject({ message: 'Invitation already accepted.' })
        })

        it('throws when invite cancelled', async () => {
            const invite = createMockInvite({ status: 'CANCELLED' })
            mockedInviteModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(invite) }))

            await expect(
                OrganisationInviteService.acceptInvite({ token: invite.token, userId: 'u', userEmail: invite.inviteeEmail })
            ).rejects.toMatchObject({ message: 'Invitation has been cancelled.' })
        })

        it('marks expired and throws when invite expired', async () => {
            const invite = createMockInvite({ expiresAt: new Date(Date.now() - 1000), status: 'PENDING' })
            mockedInviteModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(invite) }))

            await expect(
                OrganisationInviteService.acceptInvite({ token: invite.token, userId: 'u', userEmail: invite.inviteeEmail })
            ).rejects.toMatchObject({ message: 'Invitation has expired.' })

            expect(invite.status).toBe('EXPIRED')
            expect(invite.save).toHaveBeenCalled()
        })

        it('throws when invite email does not match', async () => {
            const invite = createMockInvite()
            mockedInviteModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(invite) }))

            await expect(
                OrganisationInviteService.acceptInvite({ token: invite.token, userId: 'u', userEmail: 'other@example.com' })
            ).rejects.toMatchObject({ message: 'Invite email does not match authenticated user.' })
        })

        it('throws OrganisationInviteServiceError when associating user to organisation fails', async () => {
            const invite = createMockInvite()
            const org = { _id: new Types.ObjectId(), name: 'Org Name' }
            const dept = { _id: new Types.ObjectId() }

            mockedInviteModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(invite) }))
            mockedOrgModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(org) }))
            mockedSpecialityModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(dept) }))

            // simulate unexpected error from UserOrganizationService
            mockedUserOrg.createUserOrganizationMapping.mockRejectedValueOnce(new Error('connection failed'))

            await expect(
                OrganisationInviteService.acceptInvite({ token: invite.token, userId: 'user-42', userEmail: invite.inviteeEmail })
            ).rejects.toMatchObject({ message: 'Unable to associate user with organisation.', statusCode: 500 })
        })

        it('skips duplicate-key error when associating user to organisation and proceeds', async () => {
            const invite = createMockInvite()
            const org = { _id: new Types.ObjectId(), name: 'Org Name' }
            const dept = { _id: new Types.ObjectId() }

            mockedInviteModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(invite) }))
            mockedOrgModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(org) }))
            mockedSpecialityModel.findOne.mockImplementationOnce(() => ({ setOptions: () => Promise.resolve(dept) }))

            // simulate duplicate key error coming from underlying createUserOrganizationMapping
            const duplicateError: any = new Error('duplicate')
            duplicateError.code = 11000
            mockedUserOrg.createUserOrganizationMapping.mockRejectedValueOnce(duplicateError)
            mockedSpecialityModel.updateOne.mockResolvedValueOnce({})

            const result = await OrganisationInviteService.acceptInvite({ token: invite.token, userId: 'user-42', userEmail: invite.inviteeEmail })

            expect(invite.save).toHaveBeenCalled()
            expect(mockedSpecialityModel.updateOne).toHaveBeenCalled()
            expect(result).toHaveProperty('_id')
        })
    })
})