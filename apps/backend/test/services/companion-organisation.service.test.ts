import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { CompanionOrganisationService, CompanionOrganisationServiceError } from '../../src/services/companion-organisation.service';
import CompanionOrganisationModel from '../../src/models/companion-organisation';
import ParentCompanionModel from 'src/models/parent-companion';
import CompanionModel from '../../src/models/companion';
import { ParentModel } from 'src/models/parent';

// --- Global Mocks Setup (Inline definitions to prevent TDZ issues) ---

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(),
}));

jest.mock('src/utils/sanitize', () => ({
  assertSafeString: jest.fn((val) => val),
}));

jest.mock('../../src/models/companion-organisation', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('src/models/parent-companion', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock('../../src/models/companion', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock('src/models/parent', () => ({
  __esModule: true,
  ParentModel: {
    findById: jest.fn(),
  },
}));

describe('CompanionOrganisationService', () => {
  const validObjectId = new Types.ObjectId();
  const validIdStr = validObjectId.toHexString();

  beforeEach(() => {
    jest.clearAllMocks();
    (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  });

  describe("Validation (ensureObjectId)", () => {
    it("should throw if ID is invalid string", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: "invalid",
          companionId: validCompanionId,
          organisationId: validOrgId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow("Invalid parentId");
    });

    it("should throw if ID contains injection chars ($)", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: "$invalid",
          companionId: validCompanionId,
          organisationId: validOrgId,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow("Invalid parentId");
    });

    it("should throw if ID is not a string or ObjectId", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          // @ts-expect-error Intentional invalid type for test coverage.
          parentId: 123,
        }),
      ).rejects.toThrow("Invalid parentId");
    });
  });

  describe('CompanionOrganisationServiceError', () => {
    it('should correctly set properties', () => {
      const error = new CompanionOrganisationServiceError('Test Error', 404);
      expect(error.message).toBe('Test Error');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('CompanionOrganisationServiceError');
    });
  });

  describe('ensureObjectId (Internal Helper)', () => {
    it('should accept a Types.ObjectId directly', async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(true);
      await CompanionOrganisationService.linkByParent({
        parentId: validObjectId,
        companionId: validObjectId,
        organisationId: validObjectId,
        organisationType: 'HOSPITAL',
      });
      expect(CompanionOrganisationModel.findOne).toHaveBeenCalled();
    });

    it('should throw if value is not a string', async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: 123 as any,
          companionId: validIdStr,
          organisationId: validIdStr,
          organisationType: 'HOSPITAL',
        })
      ).rejects.toThrow(new CompanionOrganisationServiceError('Invalid parentId', 400));
    });

    it('should throw if value contains a dollar sign ($)', async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: validIdStr,
          companionId: '12345678901234567890123$',
          organisationId: validIdStr,
          organisationType: 'HOSPITAL',
        })
      ).rejects.toThrow(new CompanionOrganisationServiceError('Invalid companionId', 400));
    });

    it('should throw if value contains a dot (.)', async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: validIdStr,
          companionId: validIdStr,
          organisationId: '12345678901234567890123.',
          organisationType: 'HOSPITAL',
        })
      ).rejects.toThrow(new CompanionOrganisationServiceError('Invalid organisationId', 400));
    });

    it('should throw if string is not a 24 character hex', async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: 'invalid-hex-string',
          companionId: validIdStr,
          organisationId: validIdStr,
          organisationType: 'HOSPITAL',
        })
      ).rejects.toThrow(new CompanionOrganisationServiceError('Invalid parentId', 400));
    });
  });

  describe('linkByParent', () => {
    it('should return existing link if it exists', async () => {
      const mockExisting = { _id: 'existing_link' };
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(mockExisting);

      const result = await CompanionOrganisationService.linkByParent({
        parentId: validIdStr, companionId: validIdStr, organisationId: validIdStr, organisationType: 'HOSPITAL'
      });
      expect(result).toEqual(mockExisting);
      expect(CompanionOrganisationModel.create).not.toHaveBeenCalled();
    });

    it('should create and return a new link if it does not exist', async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue({ _id: 'new_link' });

      const result = await CompanionOrganisationService.linkByParent({
        parentId: validIdStr, companionId: validIdStr, organisationId: validIdStr, organisationType: 'HOSPITAL'
      });
      expect(CompanionOrganisationModel.create).toHaveBeenCalledWith(expect.objectContaining({
        organisationType: 'HOSPITAL',
        role: 'ORGANISATION',
        status: 'ACTIVE',
      }));
      expect(result).toEqual({ _id: 'new_link' });
    });
  });

  describe('linkByPmsUser', () => {
    it('should return existing link if found', async () => {
      const mockExisting = { _id: 'existing_link' };
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(mockExisting);

      const result = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: 'u1', companionId: validIdStr, organisationId: validIdStr, organisationType: 'BREEDER'
      });
      expect(result).toEqual(mockExisting);
    });

    it('should create new pending link if not found', async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue({ _id: 'new_link' });

      const result = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: 'u1', companionId: validIdStr, organisationId: validIdStr, organisationType: 'BREEDER'
      });
      expect(CompanionOrganisationModel.create).toHaveBeenCalledWith(expect.objectContaining({
        linkedByPmsUserId: 'u1',
        organisationType: 'BREEDER',
        status: 'PENDING',
      }));
      expect(result).toEqual({ _id: 'new_link' });
    });
  });

  describe('sendInvite', () => {
    it('should throw if neither email nor name are provided', async () => {
      await expect(
        CompanionOrganisationService.sendInvite({
          parentId: validIdStr, companionId: validIdStr, organisationType: 'GROOMER'
        })
      ).rejects.toThrow(new CompanionOrganisationServiceError('Email required or Name', 400));
    });
  });

    it('should create invite with token when valid inputs are provided', async () => {
      (randomUUID as jest.Mock).mockReturnValue('mock-uuid-token');
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue({ _id: 'invite_id' });

      const result = await CompanionOrganisationService.sendInvite({
        parentId: validIdStr, companionId: validIdStr, organisationType: 'GROOMER', email: 'test@test.com'
      });

      expect(CompanionOrganisationModel.create).toHaveBeenCalledWith(expect.objectContaining({
        inviteToken: 'mock-uuid-token',
        invitedViaEmail: 'test@test.com',
        status: 'PENDING',
      }));
      expect(result).toEqual({ _id: 'invite_id' });
    });
  });

  describe('validateInvite', () => {
    it('should throw if token is empty', async () => {
      await expect(CompanionOrganisationService.validateInvite('')).rejects.toThrow(
        new CompanionOrganisationServiceError('Invite token missing', 400)
      );
    });

    it('should throw if invite not found', async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(CompanionOrganisationService.validateInvite('token123')).rejects.toThrow(
        new CompanionOrganisationServiceError('Invalid or expired invite', 404)
      );
    });

    it('should return the invite on success', async () => {
      const mockInvite = { _id: 'invite1' };
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(mockInvite);
      const result = await CompanionOrganisationService.validateInvite('token123');
      expect(result).toEqual(mockInvite);
    });
  });

  describe('acceptInvite', () => {
    it('should throw if invite not found', async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(CompanionOrganisationService.acceptInvite({ token: 't1', organisationId: validIdStr }))
        .rejects.toThrow(new CompanionOrganisationServiceError('Invalid invite token', 404));
    });

    it('should modify status to ACTIVE, clear token, and save', async () => {
      const mockSave = jest.fn();
      const mockInvite = { status: 'PENDING', inviteToken: 't1', save: mockSave };
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(mockInvite);

      await CompanionOrganisationService.acceptInvite({ token: 't1', organisationId: validIdStr });

      expect(mockInvite.status).toBe('ACTIVE');
      expect(mockInvite.inviteToken).toBeNull();
      expect(mockInvite).toHaveProperty('acceptedAt');
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('rejectInvite', () => {
    it('should throw if invite not found', async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(CompanionOrganisationService.rejectInvite({ token: 't1', organisationId: validIdStr }))
        .rejects.toThrow(new CompanionOrganisationServiceError('Invalid invite token', 404));
    });

    it('should modify status to REVOKED, clear token, and save', async () => {
      const mockSave = jest.fn();
      const mockInvite = { status: 'PENDING', inviteToken: 't1', save: mockSave };
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(mockInvite);

      await CompanionOrganisationService.rejectInvite({ token: 't1', organisationId: validIdStr });

      expect(mockInvite.status).toBe('REVOKED');
      expect(mockInvite.inviteToken).toBeNull();
      expect(mockInvite).toHaveProperty('rejectedAt');
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('linkOnCompanionCreatedByPms', () => {
    it('should pass through to linkByPmsUser', async () => {
      const spy = jest.spyOn(CompanionOrganisationService, 'linkByPmsUser').mockResolvedValue({ _id: 'linked' } as any);

      await CompanionOrganisationService.linkOnCompanionCreatedByPms({
        pmsUserId: 'u1', companionId: validIdStr, organisationId: validIdStr, organisationType: 'BOARDER'
      });

      expect(spy).toHaveBeenCalledWith({
        pmsUserId: 'u1', companionId: validIdStr, organisationId: validIdStr, organisationType: 'BOARDER'
      });
      spy.mockRestore();
    });
  });

  describe('linkOnAppointmentBooked', () => {
    it('should return existing link if found', async () => {
      const mockExisting = { _id: 'exist' };
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(mockExisting);

      const result = await CompanionOrganisationService.linkOnAppointmentBooked({
        companionId: validIdStr, organisationId: validIdStr, organisationType: 'HOSPITAL'
      });
      expect(result).toEqual(mockExisting);
    });

    it('should create active link if not found', async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue({ _id: 'new_app_link' });

      const result = await CompanionOrganisationService.linkOnAppointmentBooked({
        companionId: validIdStr, organisationId: validIdStr, organisationType: 'HOSPITAL'
      });
      expect(CompanionOrganisationModel.create).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ACTIVE',
        role: 'ORGANISATION',
      }));
      expect(result).toEqual({ _id: 'new_app_link' });
    });
  });

  describe('revokeLink', () => {
    it('should throw if link not found during update', async () => {
      (CompanionOrganisationModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
      await expect(CompanionOrganisationService.revokeLink(validIdStr))
        .rejects.toThrow(new CompanionOrganisationServiceError('Link not found', 404));
    });

    it('should return updated link', async () => {
      const mockLink = { _id: 'l1', status: 'REVOKED' };
      (CompanionOrganisationModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockLink);

      const result = await CompanionOrganisationService.revokeLink(validIdStr);
      expect(CompanionOrganisationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(Types.ObjectId), { status: 'REVOKED' }, { new: true }
      );
      expect(result).toEqual(mockLink);
    });
  });

  describe('parentApproveLink', () => {
    it('should throw if pending link not found', async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(CompanionOrganisationService.parentApproveLink(validObjectId, validIdStr))
        .rejects.toThrow(new CompanionOrganisationServiceError('Pending link not found.', 404));
    });

    it('should approve link, set parent ID, and save', async () => {
      const mockSave = jest.fn();
      const mockLink = { status: 'PENDING', linkedByParentId: null, save: mockSave };
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(mockLink);

      await CompanionOrganisationService.parentApproveLink(validObjectId, validIdStr);

      expect(mockLink.status).toBe('ACTIVE');
      expect(mockLink.linkedByParentId).toBe(validObjectId);
      expect(mockLink).toHaveProperty('acceptedAt');
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('parentRejectLink', () => {
    it('should throw if pending link not found', async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(CompanionOrganisationService.parentRejectLink(validObjectId, validIdStr))
        .rejects.toThrow(new CompanionOrganisationServiceError('Pending link not found.', 404));
    });

    it('should reject link, set parent ID, and save', async () => {
      const mockSave = jest.fn();
      const mockLink = { status: 'PENDING', linkedByParentId: null, acceptedAt: new Date(), save: mockSave };
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(mockLink);

      await CompanionOrganisationService.parentRejectLink(validObjectId, validIdStr);

      expect(mockLink.status).toBe('REVOKED');
      expect(mockLink.linkedByParentId).toBe(validObjectId);
      expect(mockLink.acceptedAt).toBeNull();
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('getLinksForCompanion', () => {
    it('should query links by companion ID', async () => {
      (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue(['l1', 'l2']);
      const res = await CompanionOrganisationService.getLinksForCompanion(validIdStr);
      expect(res).toEqual(['l1', 'l2']);
      expect(CompanionOrganisationModel.find).toHaveBeenCalledWith({ companionId: expect.any(Types.ObjectId) });
    });
  });

  describe('getLinksForOrganisation', () => {
    it('should query links by organisation ID', async () => {
      (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue(['l1']);
      const res = await CompanionOrganisationService.getLinksForOrganisation(validIdStr);
      expect(res).toEqual(['l1']);
      expect(CompanionOrganisationModel.find).toHaveBeenCalledWith({ organisationId: expect.any(Types.ObjectId) });
    });
  });

  describe('getLinksForCompanionByOrganisationTye', () => {
    it('should return structured data handling optional chaining for undefined parents/companions', async () => {
      const mockPopulate = jest.fn().mockResolvedValue(['populatedLink1']);
      (CompanionOrganisationModel.find as jest.Mock).mockReturnValue({ populate: mockPopulate });

      // Mock ParentCompanion link resolving to null
      (ParentCompanionModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Mock Companion and Parent resolving to null
      (CompanionModel.findById as jest.Mock).mockResolvedValue(null);
      (ParentModel.findById as jest.Mock).mockResolvedValue(null);

      const res = await CompanionOrganisationService.getLinksForCompanionByOrganisationTye(validIdStr, 'HOSPITAL');

      expect(res.links).toEqual(['populatedLink1']);
      expect(res.parentName).toBe('undefined undefined'); // Tests logic: parent?.firstName + " " + parent?.lastName when undefined
      expect(res.email).toBeUndefined();
      expect(res.companionName).toBeUndefined();
      expect(res.phoneNumber).toBeUndefined();
    });

    it('should return populated structure when records exist', async () => {
      const mockPopulate = jest.fn().mockResolvedValue(['populatedLink2']);
      (CompanionOrganisationModel.find as jest.Mock).mockReturnValue({ populate: mockPopulate });

      (ParentCompanionModel.findOne as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ parentId: validIdStr }),
      });

      (CompanionModel.findById as jest.Mock).mockResolvedValue({ name: 'Fido' });
      (ParentModel.findById as jest.Mock).mockResolvedValue({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@doe.com',
        phoneNumber: '12345'
      });

      const res = await CompanionOrganisationService.getLinksForCompanionByOrganisationTye(validIdStr, 'HOSPITAL');

      expect(res.parentName).toBe('John Doe');
      expect(res.email).toBe('john@doe.com');
      expect(res.companionName).toBe('Fido');
      expect(res.phoneNumber).toBe('12345');
    });
  });
});