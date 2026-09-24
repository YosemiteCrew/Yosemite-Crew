import apiClient from '@/shared/services/apiClient';
import {medicalRecordApi} from '@/features/companion/services/medicalRecordService';

jest.mock('@/shared/services/apiClient', () => {
  const actual = jest.requireActual('@/shared/services/apiClient');
  return {
    __esModule: true,
    ...actual,
    default: {get: jest.fn()},
  };
});

describe('medicalRecordApi', () => {
  const get = apiClient.get as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it('loads owner-scoped allergies with bearer authentication', async () => {
    const allergies = [{id: 'a1', allergen: 'Chicken', status: 'ACTIVE'}];
    get.mockResolvedValue({data: {allergies}});

    await expect(
      medicalRecordApi.fetchAllergies('pet/1', 'token'),
    ).resolves.toEqual(allergies);
    expect(get).toHaveBeenCalledWith(
      '/v1/patient-allergies/mobile/companion/pet%2F1',
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
      },
    );
  });

  it('loads owner-scoped problems and normalizes a missing collection', async () => {
    get.mockResolvedValue({data: {}});

    await expect(
      medicalRecordApi.fetchProblems('pet-1', 'token'),
    ).resolves.toEqual([]);
    expect(get).toHaveBeenCalledWith(
      '/v1/patient-problems/mobile/companion/pet-1',
      {
        headers: expect.objectContaining({Authorization: 'Bearer token'}),
      },
    );
  });

  it('normalizes a missing allergy collection', async () => {
    get.mockResolvedValue({data: {}});

    await expect(
      medicalRecordApi.fetchAllergies('pet-1', 'token'),
    ).resolves.toEqual([]);
  });

  it('propagates an authorization or network failure to the screen', async () => {
    get.mockRejectedValue(new Error('Forbidden'));

    await expect(
      medicalRecordApi.fetchAllergies('pet-1', 'token'),
    ).rejects.toThrow('Forbidden');
  });
});
