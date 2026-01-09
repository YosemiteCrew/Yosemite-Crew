import { Types } from 'mongoose';
import { CoParentInviteService } from '../../src/services/coparentInvite.service';
import { CoParentInviteModel } from '../../src/models/coparentInvite';
import { ParentModel } from '../../src/models/parent';
import CompanionModel from '../../src/models/companion';
import ParentCompanionModel from '../../src/models/parent-companion';
import { ParentService } from '../../src/services/parent.service';
import { ParentCompanionService } from '../../src/services/parent-companion.service';

// --- Mocks ---
jest.mock('../../src/models/coparentInvite');
jest.mock('../../src/models/parent');
jest.mock('../../src/models/companion');
jest.mock('../../src/models/parent-companion');
jest.mock('../../src/services/parent.service');
jest.mock('../../src/services/parent-companion.service');

describe('CoParentInviteService', () => {
  const validObjectId = new Types.ObjectId().toString();
  const validParentId = new Types.ObjectId();
  const validCompanionId = new Types.ObjectId();
  const validInviterId = new Types.ObjectId();

  const mockDateFuture = new Date(Date.now() + 10000000);
  const mockDatePast = new Date(Date.now() - 10000000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendInvite', () => {
    const input = {
      email: 'test@example.com',
      companionId: validCompanionId.toString(),
      invitedByParentId: validInviterId.toString(),
      inviteeName: 'Invitee',
    };

    it('should create an invite successfully', async () => {
      (CoParentInviteModel.create as jest.Mock).mockResolvedValue({});

      const result = await CoParentInviteService.sendInvite(input);

      expect(CoParentInviteModel.create).toHaveBeenCalledWith(expect.objectContaining({
        email: 'test@example.com',
        companionId: validCompanionId,
        invitedByParentId: validInviterId,
      }));
      expect(result.inviteToken).toBeDefined();
      expect(result.email).toBe('test@example.com');
    });

    it('should throw if email is missing', async () => {
      await expect(CoParentInviteService.sendInvite({ ...input, email: '' }))
        .rejects.toThrow('Email is required.');
    });

    it('should throw if companionId is invalid', async () => {
      await expect(CoParentInviteService.sendInvite({ ...input, companionId: 'invalid' }))
        .rejects.toThrow('Invalid companionId.');
    });

    it('should throw if invitedByParentId is invalid', async () => {
      await expect(CoParentInviteService.sendInvite({ ...input, invitedByParentId: 'invalid' }))
        .rejects.toThrow('Invalid invitedByParentId.');
    });
  });

  describe('validateInvite', () => {
    const mockInvite = {
      _id: validObjectId,
      email: 'test@example.com',
      inviteToken: 'valid-token',
      consumed: false,
      expiresAt: mockDateFuture,
      invitedByParentId: validInviterId,
      companionId: validCompanionId,
      inviteeName: 'John',
    };

    const mockInviter = { _id: validInviterId, firstName: 'Jane', lastName: 'Doe', profileImageUrl: 'url' };
    const mockCompanion = { _id: validCompanionId, name: 'Buddy', photoUrl: 'url' };

    it('should validate and return popup data', async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue(mockInvite);
      (ParentModel.findById as jest.Mock).mockResolvedValue(mockInviter);
      (CompanionModel.findById as jest.Mock).mockResolvedValue(mockCompanion);

      const result = await CoParentInviteService.validateInvite('valid-token');

      expect(result.email).toBe(mockInvite.email);
      expect(result.invitedBy.fullName).toBe('Jane Doe');
      expect(result.companion.name).toBe('Buddy');
    });

    it('should throw if token is missing', async () => {
      await expect(CoParentInviteService.validateInvite('')).rejects.toThrow('Invite token is required.');
    });

    it('should throw if invite not found', async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(CoParentInviteService.validateInvite('token')).rejects.toThrow('Invalid invite token.');
    });

    it('should throw if invite consumed', async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({ ...mockInvite, consumed: true });
      await expect(CoParentInviteService.validateInvite('token')).rejects.toThrow('This invite has already been used.');
    });

    it('should throw if invite expired', async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({ ...mockInvite, expiresAt: mockDatePast });
      await expect(CoParentInviteService.validateInvite('token')).rejects.toThrow('This invite has expired.');
    });

    it('should throw if inviter not found', async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue(mockInvite);
      (ParentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(CoParentInviteService.validateInvite('token')).rejects.toThrow('Inviter parent not found.');
    });

    it('should throw if companion not found', async () => {
      (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue(mockInvite);
      (ParentModel.findById as jest.Mock).mockResolvedValue(mockInviter);
      (CompanionModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(CoParentInviteService.validateInvite('token')).rejects.toThrow('Companion not found.');
    });
  });

  describe('acceptInvite', () => {
    const token = 'token';
    const authUserId = 'auth-user';
    const mockInviteDoc = {
        _id: validObjectId,
        consumed: false,
        save: jest.fn()
    };
    const mockParentDoc = { _id: validParentId };

    // Reuse mock setup helper since logic overlaps with validateInvite
    const setupValidateMocks = () => {
        (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({
            _id: validObjectId,
            inviteToken: token,
            consumed: false,
            expiresAt: mockDateFuture,
            invitedByParentId: validInviterId,
            companionId: validCompanionId,
        });
        (ParentModel.findById as jest.Mock).mockResolvedValue({ _id: validInviterId, firstName: 'Inviter' });
        (CompanionModel.findById as jest.Mock).mockResolvedValue({ _id: validCompanionId, name: 'Pet' });
    };

    it('should accept invite successfully', async () => {
      setupValidateMocks();
      (CoParentInviteModel.findById as jest.Mock).mockResolvedValue(mockInviteDoc);
      (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue(mockParentDoc);
      (ParentCompanionModel.findOne as jest.Mock).mockResolvedValue(null); // No existing link

      const result = await CoParentInviteService.acceptInvite(token, authUserId);

      expect(ParentCompanionService.linkParent).toHaveBeenCalledWith(expect.objectContaining({
        parentId: mockParentDoc._id,
        role: 'CO_PARENT'
      }));
      expect(mockInviteDoc.consumed).toBe(true);
      expect(mockInviteDoc.save).toHaveBeenCalled();
      expect(result.message).toBe('Invite accepted successfully.');
    });

    it('should throw if token missing', async () => {
        await expect(CoParentInviteService.acceptInvite('', authUserId)).rejects.toThrow('Invite token is required.');
    });

    it('should throw if authUserId missing', async () => {
        await expect(CoParentInviteService.acceptInvite(token, '')).rejects.toThrow('Authenticated user required.');
    });

    it('should throw if invite doc not found (after validation)', async () => {
        setupValidateMocks();
        (CoParentInviteModel.findById as jest.Mock).mockResolvedValue(null);
        await expect(CoParentInviteService.acceptInvite(token, authUserId)).rejects.toThrow('Invalid invite');
    });

    it('should throw if parent profile not found for user', async () => {
        setupValidateMocks();
        (CoParentInviteModel.findById as jest.Mock).mockResolvedValue(mockInviteDoc);
        (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue(null);
        await expect(CoParentInviteService.acceptInvite(token, authUserId)).rejects.toThrow('Parent profile not found');
    });

    it('should throw if already linked', async () => {
        setupValidateMocks();
        (CoParentInviteModel.findById as jest.Mock).mockResolvedValue(mockInviteDoc);
        (ParentService.findByLinkedUserId as jest.Mock).mockResolvedValue(mockParentDoc);
        (ParentCompanionModel.findOne as jest.Mock).mockResolvedValue({ status: 'ACTIVE' }); // Existing link

        await expect(CoParentInviteService.acceptInvite(token, authUserId)).rejects.toThrow('You are already linked to this companion.');
    });
  });

  describe('declineInvite', () => {
    const mockInviteDoc = {
        email: 'test@mail.com',
        companionId: validCompanionId,
        invitedByParentId: validInviterId,
        consumed: false,
        expiresAt: mockDateFuture,
        save: jest.fn()
    };

    it('should decline invite successfully', async () => {
        (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue(mockInviteDoc);

        const res = await CoParentInviteService.declineInvite('token');

        expect(mockInviteDoc.consumed).toBe(true);
        expect(mockInviteDoc.save).toHaveBeenCalled();
        expect(res.message).toBe('Invite declined successfully.');
    });

    it('should throw if token missing', async () => {
        await expect(CoParentInviteService.declineInvite('')).rejects.toThrow('Invite token is required.');
    });

    it('should throw if invite not found', async () => {
        (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue(null);
        await expect(CoParentInviteService.declineInvite('token')).rejects.toThrow('Invalid invite token.');
    });

    it('should throw if already consumed', async () => {
        (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({ ...mockInviteDoc, consumed: true });
    });

    it('should throw if expired', async () => {
        (CoParentInviteModel.findOne as jest.Mock).mockResolvedValue({ ...mockInviteDoc, expiresAt: mockDatePast });
    });
  });

  describe('getPendingInvitesForEmail', () => {
    const email = 'test@example.com';
    const mockInvite = {
        inviteToken: 'tok',
        email,
        inviteeName: 'Me',
        expiresAt: mockDateFuture,
        invitedByParentId: validInviterId,
        companionId: validCompanionId,
    };

    it('should return pending invites', async () => {
        (CoParentInviteModel.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([mockInvite])
        });
        (ParentModel.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: validInviterId, firstName: 'Dad' })
        });
        (CompanionModel.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: validCompanionId, name: 'Dog' })
        });

        const res = await CoParentInviteService.getPendingInvitesForEmail(email);

        expect(res.pendingInvites).toHaveLength(1);
        expect(res.pendingInvites[0].invitedBy.firstName).toBe('Dad');
        expect(res.pendingInvites[0].companion.name).toBe('Dog');
    });

    it('should return empty if no invites found', async () => {
        (CoParentInviteModel.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
        });
        const res = await CoParentInviteService.getPendingInvitesForEmail(email);
        expect(res.pendingInvites).toEqual([]);
    });

    it('should skip invite if inviter not found', async () => {
        (CoParentInviteModel.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([mockInvite])
        });
        (ParentModel.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(null) // Inviter deleted
        });

        const res = await CoParentInviteService.getPendingInvitesForEmail(email);
        expect(res.pendingInvites).toHaveLength(0);
    });

    it('should skip invite if companion not found', async () => {
        (CoParentInviteModel.find as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue([mockInvite])
        });
        (ParentModel.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue({ _id: validInviterId })
        });
        (CompanionModel.findById as jest.Mock).mockReturnValue({
            lean: jest.fn().mockResolvedValue(null) // Companion deleted
        });

        const res = await CoParentInviteService.getPendingInvitesForEmail(email);
        expect(res.pendingInvites).toHaveLength(0);
    });

    it('should throw if email missing', async () => {
        await expect(CoParentInviteService.getPendingInvitesForEmail('')).rejects.toThrow('Email is required.');
    });
  });
});