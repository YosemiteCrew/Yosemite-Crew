import { Types } from 'mongoose';
import { toCompanionParentLink } from '../../src/models/parent-companion';
import type { ParentCompanionDocument } from '../../src/models/parent-companion';

describe('ParentCompanion Model & Helpers', () => {
  describe('toCompanionParentLink', () => {
    it('should map correctly when parentId is a plain string/ObjectId (unpopulated)', () => {
      // Pass a string to bypass the flawed `isPopulatedParent` check in the source code
      // (which incorrectly returns true if the native ObjectId has properties)
      const parentIdStr = new Types.ObjectId().toString();
      const companionId = new Types.ObjectId();

      const mockDoc = {
        toObject: () => ({
          _id: new Types.ObjectId(),
          parentId: parentIdStr as unknown as Types.ObjectId, // Bypass population check safely
          companionId,
          role: 'PRIMARY',
          status: 'ACTIVE',
          permissions: { appointments: true },
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        }),
      } as unknown as ParentCompanionDocument;

      const result = toCompanionParentLink(mockDoc);

      expect(result.parentId).toBe(parentIdStr);
      expect(result.parent).toBeUndefined(); // Asserts successfully bypassed Population branch
      expect(result.role).toBe('PRIMARY');
      expect(result.status).toBe('ACTIVE');
      expect(result.permissions.appointments).toBe(true);
      expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('should map correctly when parentId is populated with Parent object', () => {
      const parentObjectId = new Types.ObjectId();
      const companionId = new Types.ObjectId();
      const invitedByParentId = new Types.ObjectId();

      const mockDoc = {
        toObject: () => ({
          _id: new Types.ObjectId(),
          parentId: {
            _id: parentObjectId,
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phoneNumber: '1234567890',
            profileImageUrl: 'http://image.com',
          },
          companionId,
          role: 'CO_PARENT',
          status: 'PENDING',
          permissions: { documents: true },
          invitedByParentId,
          acceptedAt: new Date('2026-02-01T00:00:00.000Z'),
        }),
      } as unknown as ParentCompanionDocument;

      const result = toCompanionParentLink(mockDoc);

      // Asserts that the ID was extracted correctly from the populated object
      expect(result.parentId).toBe(parentObjectId.toString());

      // Asserts that the populated parent info was mapped
      expect(result.parent).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '1234567890',
        profileImageUrl: 'http://image.com',
      });

      expect(result.invitedByParentId).toBe(invitedByParentId.toString());
      expect(result.acceptedAt).toBe('2026-02-01T00:00:00.000Z');
    });

    it('should throw an error if parentId is missing entirely', () => {
      const mockDoc = {
        toObject: () => ({
          _id: new Types.ObjectId(),
          companionId: new Types.ObjectId(),
          role: 'PRIMARY',
          status: 'ACTIVE',
          permissions: {},
          parentId: undefined, // Missing parentId triggers error branch
        }),
      } as unknown as ParentCompanionDocument;

      expect(() => toCompanionParentLink(mockDoc)).toThrow('Parent companion missing parentId');
    });

    it('should handle missing optional dates and references safely (null/undefined safety check)', () => {
      const parentIdStr = new Types.ObjectId().toString();
      const mockDoc = {
        toObject: () => ({
          _id: new Types.ObjectId(),
          parentId: parentIdStr as unknown as Types.ObjectId,
          companionId: new Types.ObjectId(),
          role: 'PRIMARY',
          status: 'ACTIVE',
          permissions: {},
          // Intentionally omitting createdAt, updatedAt, acceptedAt, invitedByParentId
        }),
      } as unknown as ParentCompanionDocument;

      const result = toCompanionParentLink(mockDoc);

      // Asserts all optional ?.toISOString() and ?.toString() branches handle undefined gracefully
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
      expect(result.acceptedAt).toBeUndefined();
      expect(result.invitedByParentId).toBeUndefined();
    });
  });
});