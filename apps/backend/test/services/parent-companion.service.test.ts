import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Types } from 'mongoose';
import { ParentCompanionService } from '../../src/services/parent-companion.service';
import ParentCompanionModel from '../../src/models/parent-companion';

// ----------------------------------------------------------------------
// 1. MOCKS
// ----------------------------------------------------------------------
jest.mock('../../src/models/parent-companion');

// Helper to mock mongoose chaining
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMongooseChain = (resolvedValue: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  // Cast jest.fn() to any to completely bypass strict type inference
  chain.populate = (jest.fn() as any).mockResolvedValue(resolvedValue);
  chain.exec = (jest.fn() as any).mockResolvedValue(resolvedValue);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain.then = (resolve: any) => Promise.resolve(resolvedValue).then(resolve);
  return chain;
};

// Helper for Mock Docs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDoc = (data: any) => ({
  ...data,
  _id: data._id || new Types.ObjectId(),
  save: (jest.fn() as any).mockResolvedValue(true),
  toObject: (jest.fn() as any).mockReturnValue(data),
});

describe('ParentCompanionService', () => {
  const parentId = new Types.ObjectId();
  const companionId = new Types.ObjectId();
  const targetParentId = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ======================================================================
  // 1. LINKING & ACTIVATION
  // ======================================================================
  describe('Linking', () => {
    it('linkParent: should create a PRIMARY ACTIVE link by default', async () => {
      const doc = mockDoc({ role: 'PRIMARY', status: 'ACTIVE' });
      (ParentCompanionModel.create as any).mockResolvedValue([doc]);

      const result = await ParentCompanionService.linkParent({ parentId, companionId });

      expect(ParentCompanionModel.create).toHaveBeenCalledWith([expect.objectContaining({
        role: 'PRIMARY',
        status: 'ACTIVE',
        permissions: expect.objectContaining({ assignAsPrimaryParent: true })
      })]);
      expect(result).toBe(doc);
    });

    it('linkParent: should create a CO_PARENT PENDING link by default', async () => {
      const doc = mockDoc({ role: 'CO_PARENT', status: 'PENDING' });
      (ParentCompanionModel.create as any).mockResolvedValue([doc]);

      await ParentCompanionService.linkParent({ parentId, companionId, role: 'CO_PARENT' });

      expect(ParentCompanionModel.create).toHaveBeenCalledWith([expect.objectContaining({
        role: 'CO_PARENT',
        status: 'PENDING',
        permissions: expect.objectContaining({ assignAsPrimaryParent: false })
      })]);
    });

    it('linkParent: should allow explicit status override', async () => {
        const doc = mockDoc({ role: 'CO_PARENT', status: 'ACTIVE' });
        (ParentCompanionModel.create as any).mockResolvedValue([doc]);

        await ParentCompanionService.linkParent({ parentId, companionId, role: 'CO_PARENT', status: 'ACTIVE' });

        expect(ParentCompanionModel.create).toHaveBeenCalledWith([expect.objectContaining({
          status: 'ACTIVE'
        })]);
    });

    it('linkParent: should throw 400 if IDs are missing', async () => {
       // @ts-ignore
       await expect(ParentCompanionService.linkParent({})).rejects.toThrow('Parent and companion identifiers are required');
    });

    it('linkParent: should handle duplicate PRIMARY key error', async () => {
        const error = { code: 11000 };
        (ParentCompanionModel.create as any).mockRejectedValue(error);

        await expect(ParentCompanionService.linkParent({ parentId, companionId, role: 'PRIMARY' }))
          .rejects.toThrow('Companion already has an active primary parent');
    });

    it('linkParent: should handle duplicate CO_PARENT key error', async () => {
        const error = { code: 11000 };
        (ParentCompanionModel.create as any).mockRejectedValue(error);

        await expect(ParentCompanionService.linkParent({ parentId, companionId, role: 'CO_PARENT' }))
          .rejects.toThrow('Parent is already linked to this companion');
    });

    it('linkParent: should rethrow unknown errors', async () => {
        (ParentCompanionModel.create as any).mockRejectedValue(new Error('Boom'));
        await expect(ParentCompanionService.linkParent({ parentId, companionId })).rejects.toThrow('Boom');
    });

    it('activateLink: should update status to ACTIVE', async () => {
        const doc = mockDoc({ status: 'ACTIVE' });
        (ParentCompanionModel.findOneAndUpdate as any).mockResolvedValue(doc);

        const res = await ParentCompanionService.activateLink(parentId, companionId);
        expect(res).toBe(doc);
    });

    it('revokeLink: should set status to REVOKED', async () => {
        const doc = mockDoc({ status: 'REVOKED' });
        (ParentCompanionModel.findByIdAndUpdate as any).mockResolvedValue(doc);

        const res = await ParentCompanionService.revokeLink(new Types.ObjectId());
        expect(res.status).toBe('REVOKED');
    });

    it('revokeLink: should throw if not found', async () => {
        (ParentCompanionModel.findByIdAndUpdate as any).mockResolvedValue(null);
        await expect(ParentCompanionService.revokeLink(new Types.ObjectId())).rejects.toThrow('Link not found');
    });
  });

  // ======================================================================
  // 2. PERMISSIONS & PROMOTION
  // ======================================================================
  describe('Permissions & Promotion', () => {

    it('updatePermissions: should promote to PRIMARY if flag is set', async () => {
        const targetLink = mockDoc({
            _id: new Types.ObjectId(),
            role: 'CO_PARENT',
            status: 'ACTIVE',
            permissions: { assignAsPrimaryParent: false },
            companionId
        });

        // 1. Ensure Primary Check (Success)
        (ParentCompanionModel.findOne as any)
            .mockReturnValueOnce({ exec: (jest.fn() as any).mockResolvedValue(true) })
        // 2. Get Target Link (Success)
            .mockResolvedValueOnce(targetLink)
        // 3. Promote Helper -> find existing primary (None found)
            .mockResolvedValueOnce(null);

        const result = await ParentCompanionService.updatePermissions(
            parentId,
            targetParentId,
            companionId,
            { assignAsPrimaryParent: true }
        );

        expect(targetLink.role).toBe('PRIMARY');
        expect(targetLink.save).toHaveBeenCalled();
    });

    it('updatePermissions: should throw if unassigning primary directly', async () => {
        (ParentCompanionModel.findOne as any)
            .mockReturnValueOnce({ exec: (jest.fn() as any).mockResolvedValue(true) }) // ensurePrimary
            .mockResolvedValueOnce(mockDoc({ role: 'PRIMARY', status: 'ACTIVE' })); // target is primary

        await expect(ParentCompanionService.updatePermissions(
            parentId, targetParentId, companionId, { assignAsPrimaryParent: false }
        )).rejects.toThrow('Cannot remove primary assignment without promoting another parent first');
    });

    it('updatePermissions: should merge permissions normally', async () => {
        const targetLink = mockDoc({
            role: 'CO_PARENT',
            status: 'ACTIVE',
            permissions: { tasks: false }
        });

        (ParentCompanionModel.findOne as any)
            .mockReturnValueOnce({ exec: (jest.fn() as any).mockResolvedValue(true) })
            .mockResolvedValueOnce(targetLink);

        await ParentCompanionService.updatePermissions(parentId, targetParentId, companionId, { tasks: true });

        expect(targetLink.permissions.tasks).toBe(true);
        expect(targetLink.save).toHaveBeenCalled();
    });

    it('promoteToPrimary: should demote old primary and promote new one', async () => {
        const oldPrimary = mockDoc({ _id: new Types.ObjectId(), role: 'PRIMARY', save: (jest.fn() as any).mockResolvedValue(true) });
        const newPrimary = mockDoc({ _id: new Types.ObjectId(), role: 'CO_PARENT', companionId, save: (jest.fn() as any).mockResolvedValue(true) });

        (ParentCompanionModel.findOne as any)
             // 1. ensurePrimaryOwnership
            .mockReturnValueOnce({ exec: (jest.fn() as any).mockResolvedValue(true) })
             // 2. find target link
            .mockResolvedValueOnce(newPrimary)
             // 3. inside promoteDocumentToPrimary -> find existing primary
            .mockResolvedValueOnce(oldPrimary);

        await ParentCompanionService.promoteToPrimary(parentId, companionId, targetParentId);

        expect(oldPrimary.role).toBe('CO_PARENT');
        expect(oldPrimary.save).toHaveBeenCalled();
        expect(newPrimary.role).toBe('PRIMARY');
        expect(newPrimary.save).toHaveBeenCalled();
    });

    it('promoteToPrimary: should handle race condition (duplicate key)', async () => {
        const newPrimary = mockDoc({ _id: new Types.ObjectId(), role: 'CO_PARENT', companionId });
        // Make save throw duplicate key error
        newPrimary.save.mockRejectedValue({ code: 11000 });

        (ParentCompanionModel.findOne as any)
            .mockReturnValueOnce({ exec: (jest.fn() as any).mockResolvedValue(true) })
            .mockResolvedValueOnce(newPrimary) // target
            .mockResolvedValueOnce(null); // no existing primary found by query (race condition sim)

        await expect(ParentCompanionService.promoteToPrimary(parentId, companionId, targetParentId))
            .rejects.toThrow('Companion already has an active primary parent');
    });

    it('promoteToPrimary: should throw if target link missing', async () => {
        (ParentCompanionModel.findOne as any)
            .mockReturnValueOnce({ exec: (jest.fn() as any).mockResolvedValue(true) })
            .mockResolvedValueOnce(null);

        await expect(ParentCompanionService.promoteToPrimary(parentId, companionId, targetParentId))
            .rejects.toThrow('Co-parent link not found');
    });
  });

  // ======================================================================
  // 3. REMOVAL & OWNERSHIP
  // ======================================================================
  describe('Removal & Ownership', () => {
    it('removeCoParent: should soft delete (revoke)', async () => {
        (ParentCompanionModel.findOne as any)
            .mockReturnValueOnce({ exec: (jest.fn() as any).mockResolvedValue(true) }); // ensure owner

        (ParentCompanionModel.findOneAndUpdate as any).mockResolvedValue(mockDoc({ status: 'REVOKED' }));

        await ParentCompanionService.removeCoParent(parentId, targetParentId, companionId, true);

        expect(ParentCompanionModel.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ role: 'CO_PARENT' }),
            expect.objectContaining({ $set: { status: 'REVOKED' } }),
            expect.anything()
        );
    });

    it('removeCoParent: should hard delete', async () => {
        (ParentCompanionModel.findOne as any)
            .mockReturnValueOnce({ exec: (jest.fn() as any).mockResolvedValue(true) });

        (ParentCompanionModel.deleteOne as any).mockResolvedValue({ deletedCount: 1 });

        await ParentCompanionService.removeCoParent(parentId, targetParentId, companionId, false);

        expect(ParentCompanionModel.deleteOne).toHaveBeenCalled();
    });

    it('removeCoParent: should throw if hard delete finds nothing', async () => {
        (ParentCompanionModel.findOne as any)
            .mockReturnValueOnce({ exec: (jest.fn() as any).mockResolvedValue(true) });

        (ParentCompanionModel.deleteOne as any).mockResolvedValue({ deletedCount: 0 });

        await expect(ParentCompanionService.removeCoParent(parentId, targetParentId, companionId, false))
            .rejects.toThrow('Co-parent link not found');
    });

    it('ensurePrimaryOwnership: should throw if link not found', async () => {
        // mock return null for findOne().exec()
        const mockQuery = { exec: (jest.fn() as any).mockResolvedValue(null) };
        (ParentCompanionModel.findOne as any).mockReturnValue(mockQuery);

        await expect(ParentCompanionService.ensurePrimaryOwnership(parentId, companionId))
            .rejects.toThrow('You are not authorized');
    });
  });

  // ======================================================================
  // 4. RETRIEVAL HELPERS
  // ======================================================================
  describe('Retrieval Helpers', () => {
      it('getLinksForCompanion: should populate parentId', async () => {
          (ParentCompanionModel.find as any).mockReturnValue(mockMongooseChain([
              mockDoc({ parentId: { _id: parentId, firstName: 'John' } })
          ]));

          const res = await ParentCompanionService.getLinksForCompanion(companionId);
          expect(ParentCompanionModel.find).toHaveBeenCalledWith({ companionId }, null, expect.anything());
          expect(res).toHaveLength(1);
      });

      it('getLinksForParent: should return links', async () => {
          (ParentCompanionModel.find as any).mockResolvedValue([mockDoc({})]);
          const res = await ParentCompanionService.getLinksForParent(parentId);
          expect(res).toHaveLength(1);
      });

      it('getActiveCompanionIdsForParent: should return IDs only', async () => {
          (ParentCompanionModel.find as any).mockResolvedValue([
              { companionId: 'id1' }, { companionId: 'id2' }
          ]);
          const res = await ParentCompanionService.getActiveCompanionIdsForParent(parentId);
          expect(res).toEqual(['id1', 'id2']);
      });

      it('hasAnyLinks: should return true if count > 0', async () => {
          (ParentCompanionModel.countDocuments as any).mockResolvedValue(5);
          const res = await ParentCompanionService.hasAnyLinks(parentId);
          expect(res).toBe(true);
      });

      it('deleteLinksForCompanion: should return count', async () => {
          (ParentCompanionModel.deleteMany as any).mockResolvedValue({ deletedCount: 3 });
          const count = await ParentCompanionService.deleteLinksForCompanion(companionId);
          expect(count).toBe(3);
      });

      it('deleteLinksForParent: should return count', async () => {
          (ParentCompanionModel.deleteMany as any).mockResolvedValue({ deletedCount: 2 });
          const count = await ParentCompanionService.deleteLinksForParent(parentId);
          expect(count).toBe(2);
      });
  });
});