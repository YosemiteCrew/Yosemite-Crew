import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Types } from 'mongoose';
import { UserProfileService } from '../../src/services/user-profile.service';
import UserProfileModel from '../../src/models/user-profile';
import { BaseAvailabilityService, BaseAvailabilityServiceError } from '../../src/services/base-availability.service';
import UserOrganizationModel from '../../src/models/user-organization';
import * as UploadMiddleware from '../../src/middlewares/upload';

// ----------------------------------------------------------------------
// 1. MOCKS
// ----------------------------------------------------------------------
jest.mock('../../src/models/user-profile');
jest.mock('../../src/models/user-organization');
jest.mock('../../src/middlewares/upload');

// IMPORTANT: Do NOT mock the entire module if you need the real Error class for instanceof checks.
// Instead, mock only the service object methods.
jest.mock('../../src/services/base-availability.service', () => {
  // Require the actual module to get the real Error class
  const actual = jest.requireActual('../../src/services/base-availability.service') as any;
  return {
    ...actual,
    BaseAvailabilityService: {
      getByUserId: jest.fn(),
    },
  };
});

// Helper for Mock Docs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDoc = (data: any) => ({
  ...data,
  _id: data._id || new Types.ObjectId(),
  save: (jest.fn() as any).mockResolvedValue(true),
  toObject: (jest.fn() as any).mockReturnValue(data),
});

describe('UserProfileService', () => {
  const userId = 'user_123';
  const orgId = 'org_456';
  const profileId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    (UploadMiddleware.getURLForKey as any).mockImplementation((key: string) => `https://s3.amazonaws.com/${key}`);
  });

  // ======================================================================
  // 1. CREATE
  // ======================================================================
  describe('create', () => {
    const validPayload = {
      userId,
      organizationId: orgId,
      personalDetails: {
        gender: 'MALE',
        dateOfBirth: '1990-01-01',
        phoneNumber: '1234567890',
        employmentType: 'FULL_TIME',
        profilePictureUrl: 'key/to/image.jpg',
        address: {
            addressLine: '123 St',
            city: 'City',
            state: 'State',
            postalCode: '12345',
            country: 'Country'
        }
      },
      professionalDetails: {
          medicalLicenseNumber: 'LIC-123',
          specialization: 'General',
          qualification: 'MD',
          documents: [
              { type: 'LICENSE', fileUrl: 'lic.pdf', uploadedAt: new Date().toISOString() }
          ]
      }
    };

    // Valid availability mock to ensure status becomes COMPLETED
    const validAvailability = [{
      slots: [{ startTime: '09:00', endTime: '10:00', isAvailable: true }]
    }];

    it('should create a new user profile', async () => {
      (UserProfileModel.findOne as any).mockResolvedValue(null);
      // Status will be calculated, mock default DRAFT initially
      const createdDoc = mockDoc({ ...validPayload, _id: new Types.ObjectId(profileId), status: 'DRAFT' });
      (UserProfileModel.create as any).mockResolvedValue(createdDoc);
      (BaseAvailabilityService.getByUserId as any).mockResolvedValue(validAvailability);

      const result = await UserProfileService.create(validPayload);

      expect(UserProfileModel.create).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        organizationId: orgId,
        personalDetails: expect.objectContaining({ gender: 'MALE' })
      }));
      expect(result.status).toBe('COMPLETED');
    });

    it('should throw if profile already exists', async () => {
      (UserProfileModel.findOne as any).mockResolvedValue({ _id: 'exists' });
      await expect(UserProfileService.create(validPayload)).rejects.toThrow('Profile already exists');
    });

    it('should handle invalid user ID format', async () => {
        // Use a character that passes requireString (no $) but fails regex
        // e.g. a space or invalid symbol not in [A-Za-z0-9_.-]
        const invalidPayload = { ...validPayload, userId: 'invalid id' };
        await expect(UserProfileService.create(invalidPayload)).rejects.toThrow('Invalid user id format');
    });

    it('should handle BaseAvailabilityService errors', async () => {
        (UserProfileModel.findOne as any).mockResolvedValue(null);
        (UserProfileModel.create as any).mockResolvedValue(mockDoc(validPayload));

        // Throw the REAL error class so instanceof check passes
        const error = new BaseAvailabilityServiceError('Service Down', 500);
        (BaseAvailabilityService.getByUserId as any).mockRejectedValue(error);

        // The service wraps this in UserProfileServiceError with same message
        await expect(UserProfileService.create(validPayload)).rejects.toThrow('Service Down');
    });

    it('should rethrow unknown errors from availability check', async () => {
        (UserProfileModel.findOne as any).mockResolvedValue(null);
        (UserProfileModel.create as any).mockResolvedValue(mockDoc(validPayload));
        (BaseAvailabilityService.getByUserId as any).mockRejectedValue(new Error('Boom'));

        await expect(UserProfileService.create(validPayload)).rejects.toThrow('Boom');
    });
  });

  // ======================================================================
  // 2. UPDATE
  // ======================================================================
  describe('update', () => {
    const updatePayload = {
        personalDetails: { phoneNumber: '9876543210' }
    };

    it('should update existing profile', async () => {
        const doc = mockDoc({ userId, organizationId: orgId, status: 'DRAFT' });
        (UserProfileModel.findOneAndUpdate as any).mockResolvedValue(doc);
        (BaseAvailabilityService.getByUserId as any).mockResolvedValue([]);

        const result = await UserProfileService.update(userId, orgId, updatePayload);

        expect(UserProfileModel.findOneAndUpdate).toHaveBeenCalledWith(
            { userId, organizationId: orgId },
            { $set: expect.objectContaining({ personalDetails: expect.objectContaining({ phoneNumber: '9876543210' }) }) },
            expect.anything()
        );
        expect(result).toBeDefined();
    });

    it('should throw if payload is empty (no updatable fields)', async () => {
        await expect(UserProfileService.update(userId, orgId, {})).rejects.toThrow('No updatable fields provided');
    });

    it('should return null if profile not found', async () => {
        (UserProfileModel.findOneAndUpdate as any).mockResolvedValue(null);
        const result = await UserProfileService.update(userId, orgId, updatePayload);
        expect(result).toBeNull();
    });

    it('should handle availability service errors during update', async () => {
        (UserProfileModel.findOneAndUpdate as any).mockResolvedValue(mockDoc({}));

        const error = new BaseAvailabilityServiceError('Auth Error', 401);
        (BaseAvailabilityService.getByUserId as any).mockRejectedValue(error);

        await expect(UserProfileService.update(userId, orgId, updatePayload)).rejects.toThrow('Auth Error');
    });
  });

  // ======================================================================
  // 3. GET BY USER ID
  // ======================================================================
  describe('getByUserId', () => {
      it('should return profile and availability', async () => {
          const doc = mockDoc({ userId, organizationId: orgId, status: 'COMPLETED' });
          (UserProfileModel.findOne as any).mockResolvedValue(doc);
          (BaseAvailabilityService.getByUserId as any).mockResolvedValue(['avail']);
          (UserOrganizationModel.findOne as any).mockResolvedValue({ role: 'ADMIN' });

          const result = await UserProfileService.getByUserId(userId, orgId);

          expect(result?.profile.userId).toBe(userId);
          expect(result?.baseAvailability).toEqual(['avail']);
          expect(result?.mapping).toBeDefined();
      });

      it('should return null if not found', async () => {
          (UserProfileModel.findOne as any).mockResolvedValue(null);
          const result = await UserProfileService.getByUserId(userId, orgId);
          expect(result).toBeNull();
      });

      it('should handle errors fetching availability', async () => {
          (UserProfileModel.findOne as any).mockResolvedValue(mockDoc({}));

          const error = new BaseAvailabilityServiceError('Fail', 500);
          (BaseAvailabilityService.getByUserId as any).mockRejectedValue(error);

          await expect(UserProfileService.getByUserId(userId, orgId)).rejects.toThrow('Fail');
      });
  });

  // ======================================================================
  // 4. VALIDATION & SANITIZATION (Unit Helpers)
  // ======================================================================
  describe('Validation Helpers', () => {
      it('should validate string fields', async () => {
          const payload = {
              userId, organizationId: orgId,
              personalDetails: { gender: 123 }
          };
          await expect(UserProfileService.create(payload as any)).rejects.toThrow('Gender must be a string');
      });

      it('should forbid query operators in strings', async () => {
          const payload = {
              userId, organizationId: orgId,
              personalDetails: { phoneNumber: '$ne' }
          };
          await expect(UserProfileService.create(payload as any)).rejects.toThrow('Invalid character');
      });

      it('should validate enums', async () => {
          const payload = {
              userId, organizationId: orgId,
              personalDetails: { gender: 'INVALID' }
          };
          await expect(UserProfileService.create(payload as any)).rejects.toThrow('Gender must be one of');
      });

      it('should validate dates', async () => {
          const payload = {
              userId, organizationId: orgId,
              personalDetails: { dateOfBirth: 'not-a-date' }
          };
          await expect(UserProfileService.create(payload as any)).rejects.toThrow('Date of birth must be a valid date');
      });

      it('should validate numbers', async () => {
          const payload = {
              userId, organizationId: orgId,
              professionalDetails: { yearsOfExperience: 'not-a-number' }
          };
          await expect(UserProfileService.create(payload as any)).rejects.toThrow('Years of experience must be a valid number');
      });

      it('should validate document arrays', async () => {
          const payload = {
              userId, organizationId: orgId,
              professionalDetails: { documents: 'not-an-array' }
          };
          await expect(UserProfileService.create(payload as any)).rejects.toThrow('Professional documents must be an array');
      });

      it('should validate document fields', async () => {
          const payload = {
              userId, organizationId: orgId,
              professionalDetails: { documents: [{ type: null }] }
          };
          await expect(UserProfileService.create(payload as any)).rejects.toThrow('Professional document[0].type is required');
      });
  });

  // ======================================================================
  // 5. STATUS LOGIC
  // ======================================================================
  describe('Profile Status Logic', () => {
      it('should calculate COMPLETED status', async () => {
          const completeProfile = {
              personalDetails: {
                  gender: 'MALE', employmentType: 'FULL_TIME', phoneNumber: '123',
                  address: { addressLine: '1', city: 'C', state: 'S', postalCode: '0', country: 'C' }
              },
              professionalDetails: {
                  medicalLicenseNumber: '1', specialization: 'S', qualification: 'Q'
              }
          };
          const avail = [{ slots: [{ startTime: '09:00', endTime: '10:00', isAvailable: true }] }];

          (UserProfileModel.findOne as any).mockResolvedValue(null);
          (UserProfileModel.create as any).mockResolvedValue(mockDoc(completeProfile));
          (BaseAvailabilityService.getByUserId as any).mockResolvedValue(avail);

          const res = await UserProfileService.create({ userId, organizationId: orgId, ...completeProfile } as any);
          expect(res.status).toBe('COMPLETED');
      });

      it('should calculate DRAFT status if fields missing', async () => {
          const incompleteProfile = {
              personalDetails: { gender: 'MALE' }
          };
          (UserProfileModel.findOne as any).mockResolvedValue(null);
          (UserProfileModel.create as any).mockResolvedValue(mockDoc(incompleteProfile));
          (BaseAvailabilityService.getByUserId as any).mockResolvedValue([]);

          const res = await UserProfileService.create({ userId, organizationId: orgId, ...incompleteProfile } as any);
          expect(res.status).toBe('DRAFT');
      });
  });
});