import type {RelatedPerson} from '@yosemite-crew/fhir';

import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {
  createParentProfile,
  deleteParentProfile,
  fetchProfileStatus,
  updateParentProfile,
} from '@/features/account/services/profileService';

jest.mock('@/shared/services/apiClient', () => {
  const get = jest.fn();
  const request = jest.fn();
  const del = jest.fn();
  return {
    __esModule: true,
    default: {
      get,
      request,
      delete: del,
    },
    withAuthHeaders: jest.fn(() => ({Authorization: 'Bearer token'})),
  };
});

const mockedClient = apiClient as unknown as {
  get: jest.Mock;
  delete: jest.Mock;
  request: jest.Mock;
};
const mockedHeaders = withAuthHeaders as jest.MockedFunction<
  typeof withAuthHeaders
>;

// Extension URL used by toFHIRRelatedPerson when building outgoing request bodies.
const COMPLETION_EXTENSION =
  'https://yosemitecrew.com/fhir/StructureDefinition/parent-profile-completed';
// Extension URL profileService itself looks for when parsing incoming responses
// (see PROFILE_COMPLETION_EXTENSION_URL in profileService.ts) - deliberately
// different from the outgoing one above.
const PARSED_COMPLETION_EXTENSION =
  'http://example.org/fhir/StructureDefinition/parent-profile-completed';

const createRelatedPerson = (
  overrides: Partial<RelatedPerson> = {},
): RelatedPerson => ({
  resourceType: 'RelatedPerson',
  id: 'parent-123',
  name: [
    {
      given: ['Alex'],
      family: 'Doe',
    },
  ],
  telecom: [
    {system: 'phone', value: '+123456789'},
    {system: 'email', value: 'alex@example.com'},
  ],
  address: [
    {
      line: ['123 Main St'],
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'USA',
    },
  ],
  birthDate: '1990-05-20',
  photo: [{url: 'https://cdn.example.com/photo.jpg'}],
  extension: [
    {
      url: PARSED_COMPLETION_EXTENSION,
      valueBoolean: true,
    },
  ],
  ...overrides,
});

const createAxiosError = (status: number, data?: unknown): any => {
  const error = new Error(`Axios ${status}`) as any;
  error.isAxiosError = true;
  error.response = {
    status,
    data,
  };
  return error;
};

describe('profileService', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-11-19T20:46:30.100Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchProfileStatus', () => {
    it('returns mock response when token or identifier missing', async () => {
      await expect(
        fetchProfileStatus({
          accessToken: '',
          userId: undefined,
          parentId: undefined,
        }),
      ).resolves.toEqual({
        exists: false,
        isComplete: false,
        profileToken: undefined,
        source: 'mock',
      });
    });

    it('parses a related person and returns the computed summary', async () => {
      const resource = createRelatedPerson();
      mockedClient.get.mockResolvedValueOnce({status: 200, data: resource});

      const result = await fetchProfileStatus({
        accessToken: 'token',
        userId: 'parent-123',
      });

      expect(mockedClient.get).toHaveBeenCalledWith(
        '/fhir/v1/parent/parent-123',
        {
          headers: expect.any(Object),
        },
      );
      expect(mockedHeaders).toHaveBeenCalledWith('token');
      expect(result).toEqual({
        exists: true,
        isComplete: true,
        profileToken: 'https://cdn.example.com/photo.jpg',
        source: 'remote',
        parent: expect.objectContaining({
          id: 'parent-123',
          firstName: 'Alex',
          lastName: 'Doe',
          phoneNumber: '+123456789',
          email: 'alex@example.com',
          address: expect.objectContaining({
            city: 'Austin',
            state: 'TX',
          }),
          age: 35,
        }),
      });
    });

    it('handles 404 responses gracefully', async () => {
      mockedClient.get.mockRejectedValueOnce(createAxiosError(404));

      await expect(
        fetchProfileStatus({accessToken: 'token', parentId: 'missing'}),
      ).resolves.toEqual({
        exists: false,
        isComplete: false,
        profileToken: undefined,
        source: 'remote',
      });
    });

    it('falls back to fallback source on other axios errors', async () => {
      mockedClient.get.mockRejectedValueOnce(createAxiosError(500));

      await expect(
        fetchProfileStatus({accessToken: 'token', parentId: 'p1'}),
      ).resolves.toEqual({
        exists: false,
        isComplete: false,
        profileToken: undefined,
        source: 'fallback',
      });
    });

    it('falls back to fallback source on unexpected errors', async () => {
      mockedClient.get.mockRejectedValueOnce(new Error('boom'));

      await expect(
        fetchProfileStatus({accessToken: 'token', parentId: 'p1'}),
      ).resolves.toEqual({
        exists: false,
        isComplete: false,
        profileToken: undefined,
        source: 'fallback',
      });
    });

    it('omits the address when the resource has no address entries', async () => {
      const resource = createRelatedPerson({address: undefined});
      mockedClient.get.mockResolvedValueOnce({status: 200, data: resource});

      const result = await fetchProfileStatus({
        accessToken: 'token',
        userId: 'parent-123',
      });

      expect(result.parent?.address).toBeUndefined();
    });

    it('omits age when the resource has no birthDate', async () => {
      const resource = createRelatedPerson({birthDate: undefined});
      mockedClient.get.mockResolvedValueOnce({status: 200, data: resource});

      const result = await fetchProfileStatus({
        accessToken: 'token',
        userId: 'parent-123',
      });

      expect(result.parent?.age).toBeUndefined();
    });

    it('omits age when the birthDate cannot be parsed', async () => {
      const resource = createRelatedPerson({birthDate: 'not-a-date'});
      mockedClient.get.mockResolvedValueOnce({status: 200, data: resource});

      const result = await fetchProfileStatus({
        accessToken: 'token',
        userId: 'parent-123',
      });

      expect(result.parent?.age).toBeUndefined();
    });

    it('subtracts a year when the birthday has not yet occurred this year', async () => {
      // System time is frozen at 2025-11-19; a December birthDate means the
      // birthday hasn't happened yet this year, so age is reduced by one.
      const resource = createRelatedPerson({birthDate: '1990-12-25'});
      mockedClient.get.mockResolvedValueOnce({status: 200, data: resource});

      const result = await fetchProfileStatus({
        accessToken: 'token',
        userId: 'parent-123',
      });

      expect(result.parent?.age).toBe(34);
    });

    it('subtracts a year when the birthday is later this month', async () => {
      // System time is frozen at 2025-11-19; a birthDate on the 25th of
      // November means the birthday hasn't happened yet this month.
      const resource = createRelatedPerson({birthDate: '1990-11-25'});
      mockedClient.get.mockResolvedValueOnce({status: 200, data: resource});

      const result = await fetchProfileStatus({
        accessToken: 'token',
        userId: 'parent-123',
      });

      expect(result.parent?.age).toBe(34);
    });

    it('uses the name text fallback when no given name is present', async () => {
      const resource = createRelatedPerson({
        name: [{family: 'Doe', text: 'Full Name Only'}],
      });
      mockedClient.get.mockResolvedValueOnce({status: 200, data: resource});

      const result = await fetchProfileStatus({
        accessToken: 'token',
        userId: 'parent-123',
      });

      expect(result.parent?.firstName).toBe('Full Name Only');
    });

    it('falls back to an empty id when the resource has none', async () => {
      const resource = createRelatedPerson({id: undefined});
      mockedClient.get.mockResolvedValueOnce({status: 200, data: resource});

      const result = await fetchProfileStatus({
        accessToken: 'token',
        userId: 'parent-123',
      });

      expect(result.parent?.id).toBe('');
    });

    it('reports incomplete when both the extension and the fallback derivation say incomplete', async () => {
      const resource = createRelatedPerson({
        name: [{given: [], family: ''}],
        extension: [{url: PARSED_COMPLETION_EXTENSION, valueBoolean: false}],
      });
      mockedClient.get.mockResolvedValueOnce({status: 200, data: resource});

      const result = await fetchProfileStatus({
        accessToken: 'token',
        userId: 'parent-123',
      });

      expect(result.isComplete).toBe(false);
    });

    it('falls back to the default derivation when no matching completion extension is present', async () => {
      const resource = createRelatedPerson({
        extension: [
          {url: 'https://example.com/other-extension', valueBoolean: false},
        ],
      });
      mockedClient.get.mockResolvedValueOnce({status: 200, data: resource});

      const result = await fetchProfileStatus({
        accessToken: 'token',
        userId: 'parent-123',
      });

      // No matching extension -> falls back to computeDefaultCompletion,
      // which is true since firstName/lastName/phoneNumber are all present.
      expect(result.isComplete).toBe(true);
    });
  });

  describe('parent profile mutations', () => {
    const basePayload = {
      parentId: null,
      firstName: 'Alex',
      lastName: 'Doe',
      phoneNumber: '+123456789',
      email: 'alex@example.com',
      dateOfBirth: '1990-05-20',
      address: {
        addressLine: '123 Main St',
        city: 'Austin',
        stateProvince: 'TX',
        postalCode: '78701',
        country: 'USA',
      },
      isProfileComplete: true,
      profileImageKey: 's3://photo.jpg',
    } satisfies Parameters<typeof createParentProfile>[0];

    it('creates a parent profile via POST', async () => {
      const resource = createRelatedPerson();
      mockedClient.request.mockResolvedValueOnce({status: 201, data: resource});

      const summary = await createParentProfile(basePayload, 'token');

      expect(mockedClient.request).toHaveBeenCalledWith({
        method: 'post',
        url: '/fhir/v1/parent',
        data: expect.objectContaining({
          resourceType: 'RelatedPerson',
          name: [
            expect.objectContaining({
              given: ['Alex'],
              family: 'Doe',
            }),
          ],
          telecom: expect.arrayContaining([
            expect.objectContaining({system: 'phone', value: '+123456789'}),
          ]),
          address: expect.any(Array),
          photo: [{url: 's3://photo.jpg'}],
          extension: [
            {
              url: COMPLETION_EXTENSION,
              valueBoolean: true,
            },
          ],
        }),
        headers: expect.any(Object),
      });
      expect(summary).toEqual(
        expect.objectContaining({id: 'parent-123', isComplete: true}),
      );
    });

    it('updates a parent profile via PUT', async () => {
      const resource = createRelatedPerson({extension: []});
      mockedClient.request.mockResolvedValueOnce({status: 200, data: resource});

      await updateParentProfile(
        {...basePayload, parentId: 'parent-123'},
        'token',
      );

      expect(mockedClient.request).toHaveBeenCalledWith({
        method: 'put',
        url: '/fhir/v1/parent/parent-123',
        data: expect.any(Object),
        headers: expect.any(Object),
      });
    });

    it('preserves email telecom when phone number is blank', async () => {
      const resource = createRelatedPerson({extension: []});
      mockedClient.request.mockResolvedValueOnce({status: 200, data: resource});

      await updateParentProfile(
        {
          ...basePayload,
          parentId: 'parent-123',
          phoneNumber: '',
          email: 'email-only@example.com',
        },
        'token',
      );

      expect(mockedClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'put',
          url: '/fhir/v1/parent/parent-123',
          data: expect.objectContaining({
            telecom: expect.arrayContaining([
              expect.objectContaining({
                system: 'email',
                value: 'email-only@example.com',
              }),
            ]),
          }),
        }),
      );
    });

    it('throws when updating without identifier', async () => {
      await expect(
        updateParentProfile({...basePayload, parentId: null}, 'token'),
      ).rejects.toThrow('Parent identifier is required for updates.');
    });

    it('does not append a duplicate email telecom entry when the trimmed email is blank', async () => {
      const resource = createRelatedPerson({extension: []});
      mockedClient.request.mockResolvedValueOnce({status: 200, data: resource});

      await updateParentProfile(
        {...basePayload, parentId: 'parent-123', email: ''},
        'token',
      );

      const requestBody = mockedClient.request.mock.calls[0][0].data;
      const emailEntries = requestBody.telecom.filter(
        (item: any) => item.system === 'email',
      );
      // toFHIRRelatedPerson already inserts one email entry regardless of
      // value; buildParentRequestBody's own append logic should bail out
      // early (blank trimmed email) rather than appending a second one.
      expect(emailEntries).toHaveLength(1);
    });

    it('omits dateOfBirth and address from the request body when they are not provided', async () => {
      const resource = createRelatedPerson({extension: []});
      mockedClient.request.mockResolvedValueOnce({status: 200, data: resource});

      const payloadWithoutDobOrAddress: typeof basePayload = {
        ...basePayload,
        parentId: 'parent-123',
      };
      delete payloadWithoutDobOrAddress.dateOfBirth;
      delete payloadWithoutDobOrAddress.address;
      await updateParentProfile(payloadWithoutDobOrAddress, 'token');

      const requestBody = mockedClient.request.mock.calls[0][0].data;
      expect(requestBody.birthDate).toBeUndefined();
      expect(requestBody.address ?? []).toHaveLength(0);
    });

    it('falls back to the existing photo url when no new profileImageKey is provided', async () => {
      const resource = createRelatedPerson({extension: []});
      mockedClient.request.mockResolvedValueOnce({status: 200, data: resource});

      await updateParentProfile(
        {
          ...basePayload,
          parentId: 'parent-123',
          profileImageKey: undefined,
          existingPhotoUrl: 'https://cdn.example.com/existing.jpg',
        },
        'token',
      );

      const requestBody = mockedClient.request.mock.calls[0][0].data;
      expect(requestBody.photo).toEqual([
        {url: 'https://cdn.example.com/existing.jpg'},
      ]);
    });

    it('omits the photo entirely when neither a new key nor an existing url is provided', async () => {
      const resource = createRelatedPerson({extension: []});
      mockedClient.request.mockResolvedValueOnce({status: 200, data: resource});

      await updateParentProfile(
        {
          ...basePayload,
          parentId: 'parent-123',
          profileImageKey: undefined,
          existingPhotoUrl: undefined,
        },
        'token',
      );

      const requestBody = mockedClient.request.mock.calls[0][0].data;
      expect(requestBody.photo ?? []).toHaveLength(0);
    });
  });

  describe('deleteParentProfile', () => {
    it('requires an identifier', async () => {
      await expect(deleteParentProfile('', 'token')).rejects.toThrow(
        'Parent identifier is required to delete the account.',
      );
    });

    it('deletes a parent profile successfully', async () => {
      mockedClient.delete.mockResolvedValueOnce({status: 204});

      await deleteParentProfile('parent-123', 'token');
      expect(mockedClient.delete).toHaveBeenCalledWith(
        '/fhir/v1/parent/parent-123',
        {
          headers: expect.any(Object),
        },
      );
    });

    it('throws with server message when axios error occurs', async () => {
      mockedClient.delete.mockRejectedValueOnce(
        createAxiosError(400, {message: 'Bad request'}),
      );

      await expect(deleteParentProfile('parent-123', 'token')).rejects.toThrow(
        'Bad request',
      );
    });

    it('throws generic error for unexpected failures', async () => {
      mockedClient.delete.mockRejectedValueOnce(new Error('network down'));

      await expect(deleteParentProfile('parent-123', 'token')).rejects.toThrow(
        'network down',
      );
    });

    it('falls back to the default message when the axios error has no response data', async () => {
      mockedClient.delete.mockRejectedValueOnce(
        createAxiosError(500, undefined),
      );

      await expect(deleteParentProfile('parent-123', 'token')).rejects.toThrow(
        'Failed to delete parent profile.',
      );
    });

    it('throws a generic message when a non-Error value is thrown', async () => {
      mockedClient.delete.mockRejectedValueOnce('a plain string rejection');

      await expect(deleteParentProfile('parent-123', 'token')).rejects.toThrow(
        'Failed to delete parent profile.',
      );
    });
  });
});
