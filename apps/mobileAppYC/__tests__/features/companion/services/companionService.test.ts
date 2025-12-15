import { companionApi } from '../../../../src/features/companion/services/companionService';
import apiClient from '../../../../src/shared/services/apiClient';
import {
  requestCompanionProfileUploadUrl,
  uploadFileToPresignedUrl,
} from '../../../../src/shared/services/uploadService';
import { preparePhotoPayload } from '../../../../src/features/account/utils/profilePhoto';
import {
  toFHIRCompanion,
  fromCompanionRequestDTO,
} from '@yosemite-crew/types';

// --- Mocks ---

// Mock API Client
jest.mock('../../../../src/shared/services/apiClient');
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock Upload Service
jest.mock('../../../../src/shared/services/uploadService');
const mockRequestUploadUrl = requestCompanionProfileUploadUrl as jest.Mock;
const mockUploadFile = uploadFileToPresignedUrl as jest.Mock;

// Mock Profile Photo Utils
jest.mock('../../../../src/features/account/utils/profilePhoto');
const mockPreparePhotoPayload = preparePhotoPayload as jest.Mock;

// Mock Type Converters
jest.mock('@yosemite-crew/types', () => ({
  toFHIRCompanion: jest.fn(),
  fromCompanionRequestDTO: jest.fn(),
}));
const mockToFHIR = toFHIRCompanion as jest.Mock;
const mockFromDTO = fromCompanionRequestDTO as jest.Mock;

// Mock Image URI Utils
jest.mock('../../../../src/shared/utils/imageUri', () => ({
  normalizeImageUri: (uri: string) => uri,
}));

// Mock JSON Data
jest.mock('@/features/companion/data/catBreeds.json', () => [
  { breedId: 1, breedName: 'Persian' },
], { virtual: true });
jest.mock('@/features/companion/data/dogBreeds.json', () => [
  { breedId: 2, breedName: 'Labrador' },
], { virtual: true });
jest.mock('@/features/companion/data/horseBreeds.json', () => [
  { breedId: 3, breedName: 'Arabian' },
], { virtual: true });

describe('companionService', () => {
  const MOCK_TOKEN = 'token-123';
  const MOCK_PARENT_ID = 'parent-1';
  const MOCK_COMPANION_ID = 'comp-1';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // IMPORTANT: Default mock response to prevent "undefined" errors
    mockPreparePhotoPayload.mockResolvedValue({
      localFile: null,
      remoteUrl: null,
    });
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  // ===========================================================================
  // 1. Validation & Input Handling
  // ===========================================================================

  describe('Validation', () => {
    const validPayload: any = {
      category: 'dog',
      name: 'Buddy',
      dateOfBirth: '2020-01-01',
      gender: 'male',
      origin: 'breeder',
    };

    it('should throw if category is missing', async () => {
      await expect(companionApi.create({
        parentId: MOCK_PARENT_ID,
        accessToken: MOCK_TOKEN,
        payload: { ...validPayload, category: null }
      })).rejects.toThrow('Companion category is required.');
    });

    it('should throw if gender is missing', async () => {
      await expect(companionApi.create({
        parentId: MOCK_PARENT_ID,
        accessToken: MOCK_TOKEN,
        payload: { ...validPayload, gender: null }
      })).rejects.toThrow('Companion gender is required.');
    });

    it('should throw if dateOfBirth is missing', async () => {
      await expect(companionApi.create({
        parentId: MOCK_PARENT_ID,
        accessToken: MOCK_TOKEN,
        payload: { ...validPayload, dateOfBirth: null }
      })).rejects.toThrow('Companion date of birth is required.');
    });

    it('should throw if dateOfBirth is invalid string', async () => {
      await expect(companionApi.create({
        parentId: MOCK_PARENT_ID,
        accessToken: MOCK_TOKEN,
        payload: { ...validPayload, dateOfBirth: 'not-a-date' }
      })).rejects.toThrow('Invalid companion date of birth.');
    });

    it('should throw if origin is missing', async () => {
      await expect(companionApi.create({
        parentId: MOCK_PARENT_ID,
        accessToken: MOCK_TOKEN,
        payload: { ...validPayload, origin: null }
      })).rejects.toThrow('Companion origin is required.');
    });

    it('should map category correctly for backend', async () => {
      mockApiClient.post.mockResolvedValue({ status: 201, data: {} });
      mockFromDTO.mockReturnValue({});

      // Cat
      await companionApi.create({ parentId: MOCK_PARENT_ID, accessToken: MOCK_TOKEN, payload: { ...validPayload, category: 'cat' } });
      expect(mockToFHIR).toHaveBeenCalledWith(expect.objectContaining({ type: 'cat' }));

      // Horse
      await companionApi.create({ parentId: MOCK_PARENT_ID, accessToken: MOCK_TOKEN, payload: { ...validPayload, category: 'horse' } });
      expect(mockToFHIR).toHaveBeenCalledWith(expect.objectContaining({ type: 'horse' }));

      // Default/Other (Cast to force unknown)
      await companionApi.create({ parentId: MOCK_PARENT_ID, accessToken: MOCK_TOKEN, payload: { ...validPayload, category: 'bird' as any } });
      expect(mockToFHIR).toHaveBeenCalledWith(expect.objectContaining({ type: 'other' }));
    });
  });

  // ===========================================================================
  // 2. Create (POST)
  // ===========================================================================

  describe('create', () => {
    const createPayload: any = {
      category: 'dog',
      name: 'Buddy',
      breed: { breedId: 2, breedName: 'Labrador' },
      dateOfBirth: new Date('2020-01-01'), // Test Date object input
      gender: 'male',
      origin: 'breeder',
      profileImage: 'local-uri',
      neuteredStatus: 'neutered',
      insuredStatus: 'insured',
      insuranceCompany: 'PetInsure',
      insurancePolicyNumber: 'POL-1',
    };

    it('should upload local image then create companion', async () => {
      // Setup image upload mock
      mockPreparePhotoPayload.mockResolvedValue({
        localFile: { path: 'path', mimeType: 'image/png' },
      });
      mockRequestUploadUrl.mockResolvedValue({ url: 's3-url', key: 's3-key' });

      mockToFHIR.mockReturnValue({ resourceType: 'Patient' });
      mockApiClient.post.mockResolvedValue({ status: 201, data: { id: 'new-id' } });
      mockFromDTO.mockReturnValue({ name: 'Buddy' });

      await companionApi.create({
        parentId: MOCK_PARENT_ID,
        payload: createPayload,
        accessToken: MOCK_TOKEN,
      });

      expect(mockRequestUploadUrl).toHaveBeenCalled();
      expect(mockUploadFile).toHaveBeenCalled();
      // Verify FHIR payload construction
      expect(mockToFHIR).toHaveBeenCalledWith(expect.objectContaining({
        photoUrl: 's3-key',
        isneutered: true,
        isInsured: true,
        insurance: { isInsured: true, companyName: 'PetInsure', policyNumber: 'POL-1' }
      }));
    });

    it('should handle creation error logging and rethrow', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Create Failed'));
      await expect(companionApi.create({
        parentId: MOCK_PARENT_ID,
        payload: { ...createPayload, profileImage: null },
        accessToken: MOCK_TOKEN,
      })).rejects.toThrow('Create Failed');
    });

    it('should handle creation error with unknown error object', async () => {
      mockApiClient.post.mockRejectedValue('String Error');
      await expect(companionApi.create({
        parentId: MOCK_PARENT_ID,
        payload: { ...createPayload, profileImage: null },
        accessToken: MOCK_TOKEN,
      })).rejects.toEqual('String Error');
    });
  });

  // ===========================================================================
  // 3. Update (PUT)
  // ===========================================================================

  describe('update', () => {
    const updateCompanion: any = {
      id: MOCK_COMPANION_ID,
      userId: MOCK_PARENT_ID,
      category: 'cat',
      name: 'Whiskers',
      dateOfBirth: '2019-01-01',
      gender: 'female',
      origin: 'shop',
    };

    it('should throw if id is missing', async () => {
       await expect(companionApi.update({
         companion: { ...updateCompanion, id: undefined },
         accessToken: MOCK_TOKEN,
       })).rejects.toThrow('A companion ID is required to update.');
    });

    it('should update successfully with existing image', async () => {
      mockPreparePhotoPayload.mockResolvedValue({ remoteUrl: 'http://img.com' });
      mockApiClient.put.mockResolvedValue({ status: 200, data: {} });
      mockFromDTO.mockReturnValue({});

      await companionApi.update({
        companion: updateCompanion,
        accessToken: MOCK_TOKEN,
      });

      expect(mockApiClient.put).toHaveBeenCalled();
      expect(mockToFHIR).toHaveBeenCalledWith(expect.objectContaining({
        photoUrl: 'http://img.com'
      }));
    });

    it('should handle update error logging', async () => {
      mockApiClient.put.mockRejectedValue(new Error('Update Failed'));
      await expect(companionApi.update({
        companion: updateCompanion,
        accessToken: MOCK_TOKEN,
      })).rejects.toThrow('Update Failed');
    });

    it('should handle update unknown error', async () => {
      mockApiClient.put.mockRejectedValue('Err');
      await expect(companionApi.update({
        companion: updateCompanion,
        accessToken: MOCK_TOKEN,
      })).rejects.toEqual('Err');
    });
  });

  // ===========================================================================
  // 4. Get By ID & Mapping Logic (GET)
  // ===========================================================================

  describe('getById & Mapping', () => {
    it('should fetch and map complex fields (insurance, breed, unknown types)', async () => {
      const mockResponse = {
        id: MOCK_COMPANION_ID,
        extension: [{
          url: 'http://example.org/fhir/StructureDefinition/companion-insurance',
          extension: [
            { url: 'companyName', valueString: 'InsCo' },
            { url: 'policyNumber', valueString: 'P-99' },
          ]
        }]
      };

      mockApiClient.get.mockResolvedValue({ status: 200, data: mockResponse });

      // Extensive DTO return to cover all mapping lines
      mockFromDTO.mockReturnValue({
        name: 'Max',
        type: 'dog',
        breed: 'Labrador', // Exists in mock json
        gender: 'male',
        currentWeight: 12.5,
        colour: 'Black',
        allergy: ['Pollen'],
        isneutered: true,
        ageWhenNeutered: '6m',
        bloodGroup: 'DEA 1.1',
        microchipNumber: 'MC',
        passportNumber: 'PP',
        isInsured: true,
        countryOfOrigin: 'USA',
        source: 'breeder',
        photoUrl: 'http://photo',
        dateOfBirth: new Date('2020-01-01'),
        updatedAt: new Date('2023-01-01'),
      });

      const result = await companionApi.getById({
        companionId: MOCK_COMPANION_ID,
        userId: MOCK_PARENT_ID,
        accessToken: MOCK_TOKEN,
      });

      expect(result.insuranceCompany).toBe('InsCo');
      expect(result.breed?.breedName).toBe('Labrador');
      expect(result.neuteredStatus).toBe('neutered');
      expect(result.insuredStatus).toBe('insured');
    });

    it('should handle missing fields and fallbacks', async () => {
      mockApiClient.get.mockResolvedValue({ status: 200, data: { id: 'remote-id' } });

      // Return bare minimum to force fallbacks to persisted
      mockFromDTO.mockReturnValue({});

      const persisted: any = {
        id: 'persisted-id',
        name: 'Old Name',
        breed: { breedName: 'Old Breed' },
        gender: 'female',
        currentWeight: 5,
        color: 'White',
        allergies: ['None'],
        ageWhenNeutered: '1y',
        bloodGroup: 'B',
        microchipNumber: '111',
        passportNumber: '222',
        insuranceCompany: 'Old Ins',
        insurancePolicyNumber: 'Old Pol',
        countryOfOrigin: 'CA',
        profileImage: 'old-img',
        createdAt: '2020-01-01',
      };

      const result = await companionApi.getById({
        companionId: MOCK_COMPANION_ID,
        userId: MOCK_PARENT_ID,
        accessToken: MOCK_TOKEN,
        fallback: persisted,
      });

      expect(result.id).toBe('remote-id'); // Remote ID takes precedence if present in response object
      expect(result.name).toBe('Old Name');
      expect(result.breed?.breedName).toBe('Old Breed');
      expect(result.gender).toBe('female');
      expect(result.insuranceCompany).toBe('Old Ins');
    });

    it('should map unknown/custom breeds correctly', async () => {
      mockApiClient.get.mockResolvedValue({ status: 200, data: {} });
      mockFromDTO.mockReturnValue({ type: 'cat', breed: 'SuperRareCat' }); // Not in mock json

      const result = await companionApi.getById({ companionId: '1', userId: 'u', accessToken: 't' });
      expect(result.breed).toEqual({
        speciesId: 0,
        speciesName: 'Cat',
        breedId: -1,
        breedName: 'SuperRareCat',
      });
    });

    it('should map unknown source to "unknown"', async () => {
        mockApiClient.get.mockResolvedValue({ status: 200, data: {} });
        mockFromDTO.mockReturnValue({ source: undefined });
        const result = await companionApi.getById({ companionId: '1', userId: 'u', accessToken: 't' });
        expect(result.origin).toBe('unknown');
    });

    it('should map mapSourceToOrigin correctly for specific source', async () => {
        mockApiClient.get.mockResolvedValue({ status: 200, data: {} });
        mockFromDTO.mockReturnValue({ source: 'friends_family' });
        const result = await companionApi.getById({ companionId: '1', userId: 'u', accessToken: 't' });
        expect(result.origin).toBe('friends-family');
    });

    // Coverage for mapTypeToCategory fallback
    it('should fallback category to dog if unknown', async () => {
         mockApiClient.get.mockResolvedValue({ status: 200, data: {} });
         mockFromDTO.mockReturnValue({ type: 'alien' });
         const result = await companionApi.getById({ companionId: '1', userId: 'u', accessToken: 't' });
         expect(result.category).toBe('dog');
    });

    it('should handle get error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Get Failed'));
      await expect(companionApi.getById({ companionId: '1', userId: 'u', accessToken: 't' })).rejects.toThrow('Get Failed');
    });

    it('should handle get unknown error', async () => {
        mockApiClient.get.mockRejectedValue('Err');
        await expect(companionApi.getById({ companionId: '1', userId: 'u', accessToken: 't' })).rejects.toEqual('Err');
    });
  });

  // ===========================================================================
  // 5. List By Parent
  // ===========================================================================

  describe('listByParent', () => {
    it('should handle array payload', async () => {
      mockApiClient.get.mockResolvedValue({ status: 200, data: [{ id: '1' }] });
      mockFromDTO.mockReturnValue({ name: 'C1' });
      const res = await companionApi.listByParent({ parentId: 'p', accessToken: 't' });
      expect(res).toHaveLength(1);
    });

    it('should handle { companions: [] } payload', async () => {
        mockApiClient.get.mockResolvedValue({ status: 200, data: { companions: [{ id: '1' }] } });
        mockFromDTO.mockReturnValue({ name: 'C1' });
        const res = await companionApi.listByParent({ parentId: 'p', accessToken: 't' });
        expect(res).toHaveLength(1);
    });

    it('should handle { data: [] } payload', async () => {
        mockApiClient.get.mockResolvedValue({ status: 200, data: { data: [{ id: '1' }] } });
        mockFromDTO.mockReturnValue({ name: 'C1' });
        const res = await companionApi.listByParent({ parentId: 'p', accessToken: 't' });
        expect(res).toHaveLength(1);
    });

    it('should handle { data: { companions: [] } } payload', async () => {
        mockApiClient.get.mockResolvedValue({ status: 200, data: { data: { companions: [{ id: '1' }] } } });
        mockFromDTO.mockReturnValue({ name: 'C1' });
        const res = await companionApi.listByParent({ parentId: 'p', accessToken: 't' });
        expect(res).toHaveLength(1);
    });

    it('should handle { results: [] } payload', async () => {
        mockApiClient.get.mockResolvedValue({ status: 200, data: { results: [{ id: '1' }] } });
        mockFromDTO.mockReturnValue({ name: 'C1' });
        const res = await companionApi.listByParent({ parentId: 'p', accessToken: 't' });
        expect(res).toHaveLength(1);
    });

    it('should return empty if no array found', async () => {
        mockApiClient.get.mockResolvedValue({ status: 200, data: { random: 'obj' } });
        const res = await companionApi.listByParent({ parentId: 'p', accessToken: 't' });
        expect(res).toEqual([]);
    });

    it('should handle list error', async () => {
        mockApiClient.get.mockRejectedValue(new Error('List Err'));
        await expect(companionApi.listByParent({ parentId: 'p', accessToken: 't' })).rejects.toThrow('List Err');
    });

     it('should handle list unknown error', async () => {
        mockApiClient.get.mockRejectedValue('Err');
        await expect(companionApi.listByParent({ parentId: 'p', accessToken: 't' })).rejects.toEqual('Err');
    });
  });

  // ===========================================================================
  // 6. Delete (DELETE)
  // ===========================================================================

  describe('remove', () => {
    it('should delete successfully', async () => {
      mockApiClient.delete.mockResolvedValue({ status: 204 });
      await companionApi.remove({ companionId: 'c1', accessToken: 't' });
      expect(mockApiClient.delete).toHaveBeenCalledWith(expect.stringContaining('c1'), expect.anything());
    });

    it('should throw if id is missing', async () => {
      await expect(companionApi.remove({ companionId: '', accessToken: 't' })).rejects.toThrow('Companion identifier is required');
    });

    it('should handle delete error', async () => {
        mockApiClient.delete.mockRejectedValue(new Error('Del Err'));
        await expect(companionApi.remove({ companionId: 'c1', accessToken: 't' })).rejects.toThrow('Del Err');
    });

    it('should handle delete unknown error', async () => {
        mockApiClient.delete.mockRejectedValue('Err');
        await expect(companionApi.remove({ companionId: 'c1', accessToken: 't' })).rejects.toEqual('Err');
    });
  });

  // ===========================================================================
  // 7. Extract Insurance Details (Specific Branching)
  // ===========================================================================
  describe('Insurance Extraction Edge Cases', () => {
      it('should handle missing insurance extension gracefully', async () => {
          mockApiClient.get.mockResolvedValue({ status: 200, data: { extension: [] } }); // No insurance ext
          mockFromDTO.mockReturnValue({});

          const result = await companionApi.getById({ companionId: '1', userId: 'u', accessToken: 't' });
          expect(result.insuranceCompany).toBeNull();
      });

      it('should handle insurance extension with empty nested array', async () => {
          mockApiClient.get.mockResolvedValue({
              status: 200,
              data: {
                  extension: [{
                      url: 'http://example.org/fhir/StructureDefinition/companion-insurance',
                      extension: []
                  }]
              }
          });
          mockFromDTO.mockReturnValue({});

          const result = await companionApi.getById({ companionId: '1', userId: 'u', accessToken: 't' });
          expect(result.insuranceCompany).toBeNull();
      });
  });
});