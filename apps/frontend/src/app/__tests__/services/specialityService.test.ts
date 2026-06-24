import {
  loadSpecialitiesForOrg,
  createSpeciality,
  createSpecialitiesBulk,
  createService,
  createServicesBulk,
  createBulkSpecialityServices,
  updateSpeciality,
  updateService,
  deleteSpeciality,
} from '@/app/features/organization/services/specialityService';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useServiceStore } from '@/app/stores/serviceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import * as axiosService from '@/app/services/axios';
import { deleteData } from '@/app/services/axios';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';

// --- Mocks ---

// Mock Zustand Stores
jest.mock('@/app/stores/specialityStore', () => ({
  useSpecialityStore: {
    getState: jest.fn(),
  },
}));
jest.mock('@/app/stores/serviceStore', () => ({
  useServiceStore: {
    getState: jest.fn(),
  },
}));
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

// Mock Axios Wrapper
jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  putData: jest.fn(),
  patchData: jest.fn(),
  deleteData: jest.fn(),
}));

// Mock Converters (return identity or simple transforms for predictability)
jest.mock('@yosemite-crew/types', () => ({
  fromSpecialityRequestDTO: jest.fn((x) => ({ ...x, _id: x.id || 'spec-1' })),
  toSpecialityResponseDTO: jest.fn((x) => x),
  fromServiceRequestDTO: jest.fn((x) => ({ ...x, id: x.id || 'svc-1' })),
  toServiceResponseDTO: jest.fn((x) => x),
}));

describe('specialityService', () => {
  // Store Mock Functions
  const mockStartLoading = jest.fn();
  const mockSetSpecialities = jest.fn();
  const mockAddSpeciality = jest.fn();
  const mockUpdateSpeciality = jest.fn();

  const mockSetServices = jest.fn();
  const mockAddService = jest.fn();
  const mockUpdateService = jest.fn();

  // FIX: Add the function that was reported missing in the console error.
  const mockSetServicesForOrg = jest.fn();
  const mockSetError = jest.fn();
  const mockSetSpecialitiesForOrg = jest.fn(); // Kept this one in case the service uses it

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Store Returns
    (useSpecialityStore.getState as jest.Mock).mockReturnValue({
      startLoading: mockStartLoading,
      setSpecialities: mockSetSpecialities,
      addSpeciality: mockAddSpeciality,
      updateSpeciality: mockUpdateSpeciality,
      status: 'idle',
      specialityIdsByOrgId: {},
      setSpecialitiesForOrg: mockSetSpecialitiesForOrg,
      setError: mockSetError,
      endLoading: jest.fn(), // Added endLoading for completeness, though not in the error
    });

    // FIX 1: Add setServicesForOrg to the mock for useServiceStore
    (useServiceStore.getState as jest.Mock).mockReturnValue({
      setServices: mockSetServices,
      addService: mockAddService,
      updateService: mockUpdateService,
      setServicesForOrg: mockSetServicesForOrg, // <--- THE CRITICAL FIX
    });

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: 'org-1',
    });
  });

  // ===========================================================================
  // 1. loadSpecialitiesForOrg
  // ===========================================================================

  describe('loadSpecialitiesForOrg', () => {
    it('fetches and normalizes data successfully', async () => {
      const mockPayload = {
        data: [
          {
            speciality: { id: 'spec-1', name: 'Cardiology' },
            services: [{ id: 'svc-1', name: 'ECG' }],
          },
        ],
      };
      (axiosService.getData as jest.Mock).mockResolvedValue(mockPayload);

      await loadSpecialitiesForOrg();

      expect(mockStartLoading).toHaveBeenCalled();
      expect(axiosService.getData).toHaveBeenCalledWith('/fhir/v1/speciality/organization/org-1');
    });

    it('skips fetching when the selected org already has speciality data', async () => {
      (useSpecialityStore.getState as jest.Mock).mockReturnValue({
        startLoading: mockStartLoading,
        status: 'loaded',
        specialityIdsByOrgId: { 'org-1': [] },
        setSpecialitiesForOrg: mockSetSpecialitiesForOrg,
      });

      await loadSpecialitiesForOrg();

      expect(mockStartLoading).not.toHaveBeenCalled();
      expect(axiosService.getData).not.toHaveBeenCalled();
    });

    it('fetches only once for duplicate in-flight requests for the same org', async () => {
      let resolveRequest: ((value: { data: [] }) => void) | undefined;
      (axiosService.getData as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          })
      );

      const firstRequest = loadSpecialitiesForOrg({ force: true });
      const secondRequest = loadSpecialitiesForOrg({ force: true });

      resolveRequest?.({ data: [] });
      await Promise.all([firstRequest, secondRequest]);

      expect(axiosService.getData).toHaveBeenCalledTimes(1);
    });

    // ... (All other tests in loadSpecialitiesForOrg section remain unchanged)

    it('handles malformed response (data not array)', async () => {
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: 'invalid' });
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      await loadSpecialitiesForOrg();
    });

    it('handles missing speciality object in item', async () => {
      const mockPayload = { data: [{ speciality: null }] };
      (axiosService.getData as jest.Mock).mockResolvedValue(mockPayload);
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      await loadSpecialitiesForOrg();
    });

    it('handles missing/invalid services array in item', async () => {
      const mockPayload = {
        data: [
          {
            speciality: { id: 's1' },
            services: 'not-an-array', // Invalid
          },
        ],
      };
      (axiosService.getData as jest.Mock).mockResolvedValue(mockPayload);
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      await loadSpecialitiesForOrg();
    });

    it('handles null item in payload array', async () => {
      const mockPayload = { data: [null] };
      (axiosService.getData as jest.Mock).mockResolvedValue(mockPayload);

      await loadSpecialitiesForOrg();
    });

    // NOTE: The `loadSpecialitiesForOrg` test assertion for failure was already throwing,
    // which is likely correct for a service layer function that wraps an API call.
    it('throws error on failure', async () => {
      const error = new Error('Network Error');
      (axiosService.getData as jest.Mock).mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(loadSpecialitiesForOrg()).rejects.toThrow('Network Error');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load specialities:', error);
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 2. createSpeciality (and subsequent sections)
  // ===========================================================================

  describe('createSpeciality', () => {
    const payload = { name: 'New Spec' } as any;

    it('creates speciality successfully', async () => {
      const responseData = { id: 'spec-new', name: 'New Spec' };
      (axiosService.postData as jest.Mock).mockResolvedValue({ data: responseData });

      const result = await createSpeciality(payload);

      expect(axiosService.postData).toHaveBeenCalledWith('/fhir/v1/speciality', payload);
      expect(mockAddSpeciality).toHaveBeenCalled();
      expect(result._id).toBe('spec-new');
    });

    it('throws error on failure', async () => {
      (axiosService.postData as jest.Mock).mockRejectedValue(new Error('Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(createSpeciality(payload)).rejects.toThrow('Fail');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 3. createService
  // ===========================================================================

  describe('createService', () => {
    const payload = { name: 'New Service' } as any;

    it('creates service successfully', async () => {
      const responseData = { id: 'svc-new', name: 'New Service' };
      (axiosService.postData as jest.Mock).mockResolvedValue({ data: responseData });

      await createService(payload);

      expect(axiosService.postData).toHaveBeenCalledWith('/fhir/v1/service', payload);
      expect(mockAddService).toHaveBeenCalled();
    });

    it('throws error on failure', async () => {
      (axiosService.postData as jest.Mock).mockRejectedValue(new Error('Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(createService(payload)).rejects.toThrow('Fail');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('createSpecialitiesBulk', () => {
    const payload = [{ name: 'Spec A' }, { name: 'Spec B' }] as any;

    it('creates specialities with the bulk endpoint', async () => {
      (axiosService.postData as jest.Mock).mockResolvedValue({
        data: [
          { id: 'spec-a', name: 'Spec A' },
          { id: 'spec-b', name: 'Spec B' },
        ],
      });

      const result = await createSpecialitiesBulk(payload);

      expect(axiosService.postData).toHaveBeenCalledWith('/fhir/v1/speciality/bulk', payload);
      expect(mockAddSpeciality).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe('spec-a');
    });

    it('accepts created-array bulk responses', async () => {
      (axiosService.postData as jest.Mock).mockResolvedValue({
        data: { created: [{ id: 'spec-a', name: 'Spec A' }] },
      });

      const result = await createSpecialitiesBulk(payload);

      expect(result).toHaveLength(1);
      expect(mockAddSpeciality).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'spec-a' }),
        expect.any(Number),
        expect.any(Array)
      );
    });

    it('throws error on failure', async () => {
      (axiosService.postData as jest.Mock).mockRejectedValue(new Error('Bulk Spec Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(createSpecialitiesBulk(payload)).rejects.toThrow('Bulk Spec Fail');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('createServicesBulk', () => {
    const payload = [{ name: 'Svc A' }, { name: 'Svc B' }] as any;

    it('creates services with the bulk endpoint', async () => {
      (axiosService.postData as jest.Mock).mockResolvedValue({
        data: [
          { id: 'svc-a', name: 'Svc A' },
          { id: 'svc-b', name: 'Svc B' },
        ],
      });

      const result = await createServicesBulk(payload);

      expect(axiosService.postData).toHaveBeenCalledWith('/fhir/v1/service/bulk', payload);
      expect(mockAddService).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('svc-a');
    });

    it('throws error on failure', async () => {
      (axiosService.postData as jest.Mock).mockRejectedValue(new Error('Bulk Service Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(createServicesBulk(payload)).rejects.toThrow('Bulk Service Fail');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 4. createBulkSpecialityServices
  // ===========================================================================

  describe('createBulkSpecialityServices', () => {
    it('creates multiple specialities and their services', async () => {
      const payload: SpecialityWeb[] = [
        {
          name: 'Spec A',
          services: [{ name: 'Svc A1' }, { name: 'Svc A2' }],
        } as any,
        {
          name: 'Spec B',
          // services undefined/empty
        } as any,
        null as any, // Should be skipped
      ];

      (axiosService.postData as jest.Mock)
        .mockResolvedValueOnce({
          data: [
            { id: 'spec-a', name: 'Spec A' },
            { id: 'spec-b', name: 'Spec B' },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            { id: 'svc-a1', name: 'Svc A1' },
            { id: 'svc-a2', name: 'Svc A2' },
          ],
        });

      await createBulkSpecialityServices(payload);

      expect(axiosService.postData).toHaveBeenCalledWith(
        '/fhir/v1/speciality/bulk',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Spec A', services: [] }),
          expect.objectContaining({ name: 'Spec B', services: [] }),
        ])
      );
      expect(axiosService.postData).toHaveBeenCalledWith(
        '/fhir/v1/service/bulk',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Svc A1', specialityId: 'spec-a' }),
          expect.objectContaining({ name: 'Svc A2', specialityId: 'spec-a' }),
        ])
      );
    });

    it('throws error on failure', async () => {
      const payload: SpecialityWeb[] = [{ name: 'Fail Spec' } as any];
      (axiosService.postData as jest.Mock).mockRejectedValue(new Error('Bulk Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(createBulkSpecialityServices(payload)).rejects.toThrow('Bulk Fail');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 5. updateSpeciality
  // ===========================================================================

  describe('updateSpeciality', () => {
    const payload = { _id: 'spec-1', name: 'Updated Spec' } as any;

    it('updates speciality successfully', async () => {
      (axiosService.putData as jest.Mock).mockResolvedValue({ data: payload });

      const result = await updateSpeciality(payload);

      expect(axiosService.putData).toHaveBeenCalledWith('/fhir/v1/speciality/spec-1', payload);
      expect(mockUpdateSpeciality).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ name: 'Updated Spec' }));
    });

    it('throws error on failure', async () => {
      (axiosService.putData as jest.Mock).mockRejectedValue(new Error('Update Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(updateSpeciality(payload)).rejects.toThrow('Update Fail');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 6. updateService
  // ===========================================================================

  describe('updateService', () => {
    const payload = { id: 'svc-1', name: 'Updated Svc' } as any;

    it('updates service successfully', async () => {
      (axiosService.patchData as jest.Mock).mockResolvedValue({ data: payload });

      await updateService(payload);

      expect(axiosService.patchData).toHaveBeenCalledWith('/fhir/v1/service/svc-1', payload);
      expect(mockUpdateService).toHaveBeenCalled();
    });

    it('throws error on failure', async () => {
      (axiosService.patchData as jest.Mock).mockRejectedValue(new Error('Patch Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(updateService(payload)).rejects.toThrow('Patch Fail');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 7. deleteSpeciality
  // ===========================================================================

  describe('deleteSpeciality', () => {
    const mockDeleteSpecialityById = jest.fn();
    const mockDeleteServicesBySpecialityId = jest.fn();

    beforeEach(() => {
      (useSpecialityStore.getState as jest.Mock).mockReturnValue({
        ...jest.requireActual('@/app/stores/specialityStore'),
        startLoading: mockStartLoading,
        setSpecialitiesForOrg: mockSetSpecialitiesForOrg,
        updateSpeciality: mockUpdateSpeciality,
        addSpeciality: mockAddSpeciality,
        status: 'idle',
        deleteSpecialityById: mockDeleteSpecialityById,
      });
      (useServiceStore.getState as jest.Mock).mockReturnValue({
        setServicesForOrg: mockSetServicesForOrg,
        addService: mockAddService,
        updateService: mockUpdateService,
        deleteServicesBySpecialityId: mockDeleteServicesBySpecialityId,
      });
    });

    it('deletes speciality and clears services', async () => {
      const payload = { _id: 'spec-1', organisationId: 'org-1', name: 'Spec' } as any;
      (axiosService.deleteData as jest.Mock).mockResolvedValue({});

      await deleteSpeciality(payload);

      expect(deleteData).toHaveBeenCalledWith('/fhir/v1/speciality/org-1/spec-1');
      expect(mockDeleteSpecialityById).toHaveBeenCalledWith('spec-1');
      expect(mockDeleteServicesBySpecialityId).toHaveBeenCalledWith('spec-1');
    });

    it('throws when _id or organisationId missing', async () => {
      const payload = { _id: '', organisationId: 'org-1' } as any;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(deleteSpeciality(payload)).rejects.toThrow(
        'Speciality ID or Organisation ID is missing.'
      );
      consoleSpy.mockRestore();
    });

    it('throws on API failure', async () => {
      const payload = { _id: 'spec-1', organisationId: 'org-1' } as any;
      (axiosService.deleteData as jest.Mock).mockRejectedValue(new Error('Delete failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(deleteSpeciality(payload)).rejects.toThrow('Delete failed');
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 8. loadSpecialitiesForOrg - missing orgId
  // ===========================================================================

  describe('loadSpecialitiesForOrg - edge cases', () => {
    it('returns early when no primaryOrgId', async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await loadSpecialitiesForOrg();

      expect(axiosService.getData).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('skips loading when status is loaded and force is false', async () => {
      (useSpecialityStore.getState as jest.Mock).mockReturnValue({
        startLoading: mockStartLoading,
        setSpecialitiesForOrg: mockSetSpecialitiesForOrg,
        status: 'loaded',
        specialityIdsByOrgId: { 'org-1': [] },
      });

      await loadSpecialitiesForOrg({ force: false });
      expect(axiosService.getData).not.toHaveBeenCalled();
    });

    it('loads when force is true even if status is loaded', async () => {
      (useSpecialityStore.getState as jest.Mock).mockReturnValue({
        startLoading: mockStartLoading,
        setSpecialitiesForOrg: mockSetSpecialitiesForOrg,
        status: 'loaded',
        specialityIdsByOrgId: { 'org-1': [] },
      });
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: [] });

      await loadSpecialitiesForOrg({ force: true });
      expect(axiosService.getData).toHaveBeenCalled();
    });

    it('handles null services in item', async () => {
      (axiosService.getData as jest.Mock).mockResolvedValue({
        data: [{ speciality: { id: 's1' }, services: null }],
      });

      await loadSpecialitiesForOrg();
      expect(mockSetSpecialitiesForOrg).toHaveBeenCalled();
    });

    it('silent mode does not call startLoading', async () => {
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: [] });

      await loadSpecialitiesForOrg({ silent: true });
      expect(mockStartLoading).not.toHaveBeenCalled();
    });
  });
});
