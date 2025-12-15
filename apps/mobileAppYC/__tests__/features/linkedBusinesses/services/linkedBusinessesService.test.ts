import linkedBusinessesService, {
  CheckBusinessRequest,
  InviteBusinessRequest,
  LinkBusinessRequest,
} from '../../../../src/features/linkedBusinesses/services/linkedBusinessesService';
import apiClient from '../../../../src/shared/services/apiClient';

// --- Mocks ---

jest.mock('../../../../src/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
  withAuthHeaders: jest.fn((token) => ({ Authorization: `Bearer ${token}` })),
}));

describe('linkedBusinessesService', () => {
  const mockToken = 'mock-token';
  const mockHeaders = { Authorization: `Bearer ${mockToken}` };

  // Spy on console.error to keep test output clean and verify error logging
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('fetchLinkedBusinesses', () => {
    const companionId = 'comp-123';
    const type = 'HOSPITAL';

    it('handles successful fetch returning a direct array', async () => {
      const mockData = [{ id: 'org-1', name: 'Vet' }];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockData });

      const result = await linkedBusinessesService.fetchLinkedBusinesses(
        companionId,
        type,
        mockToken,
      );

      expect(apiClient.get).toHaveBeenCalledWith(
        `/v1/companion-organisation/${companionId}?type=${type}`,
        { headers: mockHeaders },
      );
      expect(result).toEqual(mockData);
    });

    it('handles successful fetch returning a wrapped object { links: [...] }', async () => {
      // This covers the implicit return response.data logic where data might vary in structure
      // based on the backend implementation hinted at in comments
      const mockData = { links: [{ id: 'org-1', name: 'Vet' }] };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockData });

      const result = await linkedBusinessesService.fetchLinkedBusinesses(
        companionId,
        type,
        mockToken,
      );

      expect(result).toEqual(mockData);
    });

    it('handles errors', async () => {
      const error = new Error('Network Error');
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      await expect(
        linkedBusinessesService.fetchLinkedBusinesses(companionId, type, mockToken),
      ).rejects.toThrow('Network Error');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LinkedBusinesses] Failed to fetch linked businesses:',
        error,
      );
    });
  });

  describe('checkBusiness', () => {
    it('rounds coordinates and sends request without optional name', async () => {
      const request: CheckBusinessRequest = {
        placeId: 'place-123',
        lat: 12.123456789, // Should round to 12.123457
        lng: 88.987654321, // Should round to 88.987654
        addressLine: '123 Main St',
      };

      const mockResponse = { isPmsOrganisation: true };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await linkedBusinessesService.checkBusiness(request, mockToken);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/fhir/v1/organization/check',
        {
          placeId: 'place-123',
          lat: 12.123457, // Verified rounded value
          lng: 88.987654, // Verified rounded value
          addressLine: '123 Main St',
        },
        { headers: mockHeaders },
      );
      expect(result).toEqual(mockResponse);
    });

    it('includes optional name in request body when provided', async () => {
      const request: CheckBusinessRequest = {
        placeId: 'place-123',
        lat: 10,
        lng: 10,
        addressLine: '123 Main St',
        name: 'My Vet',
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      await linkedBusinessesService.checkBusiness(request, mockToken);

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: 'My Vet',
        }),
        expect.anything(),
      );
    });

    it('handles errors', async () => {
      const error = new Error('Check Failed');
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      await expect(
        linkedBusinessesService.checkBusiness({} as any, mockToken),
      ).rejects.toThrow('Check Failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LinkedBusinesses] Failed to check business:',
        error,
      );
    });
  });

  describe('linkBusiness', () => {
    it('sends link request successfully', async () => {
      const request: LinkBusinessRequest = {
        companionId: 'c-1',
        organisationId: 'o-1',
        organisationType: 'HOSPITAL',
      };
      const mockResponse = { state: 'pending' };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await linkedBusinessesService.linkBusiness(request, mockToken);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/companion-organisation/link',
        request,
        { headers: mockHeaders },
      );
      expect(result).toEqual(mockResponse);
    });

    it('handles errors', async () => {
      const error = new Error('Link Failed');
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      await expect(
        linkedBusinessesService.linkBusiness({} as any, mockToken),
      ).rejects.toThrow('Link Failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LinkedBusinesses] Failed to link business:',
        error,
      );
    });
  });

  describe('inviteBusiness', () => {
    it('sends invite request successfully', async () => {
      const request: InviteBusinessRequest = {
        companionId: 'c-1',
        email: 'test@vet.com',
        organisationType: 'GROOMER',
        name: 'Best Groomers',
      };
      const mockResponse = { success: true };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await linkedBusinessesService.inviteBusiness(request, mockToken);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/companion-organisation/invite',
        request,
        { headers: mockHeaders },
      );
      expect(result).toEqual(mockResponse);
    });

    it('handles errors', async () => {
      const error = new Error('Invite Failed');
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      await expect(
        linkedBusinessesService.inviteBusiness({} as any, mockToken),
      ).rejects.toThrow('Invite Failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LinkedBusinesses] Failed to invite business:',
        error,
      );
    });
  });

  describe('approveLinkInvite', () => {
    it('approves invite successfully', async () => {
      const linkId = 'link-123';
      const mockResponse = { state: 'active' };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await linkedBusinessesService.approveLinkInvite(linkId, mockToken);

      expect(apiClient.post).toHaveBeenCalledWith(
        `/v1/companion-organisation/${linkId}/approve`,
        {},
        { headers: mockHeaders },
      );
      expect(result).toEqual(mockResponse);
    });

    it('handles errors', async () => {
      const error = new Error('Approve Failed');
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      await expect(
        linkedBusinessesService.approveLinkInvite('id', mockToken),
      ).rejects.toThrow('Approve Failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LinkedBusinesses] Failed to approve invite:',
        error,
      );
    });
  });

  describe('denyLinkInvite', () => {
    it('denies invite successfully', async () => {
      const linkId = 'link-456';
      const mockResponse = { state: 'rejected' };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await linkedBusinessesService.denyLinkInvite(linkId, mockToken);

      expect(apiClient.post).toHaveBeenCalledWith(
        `/v1/companion-organisation/${linkId}/deny`,
        {},
        { headers: mockHeaders },
      );
      expect(result).toEqual(mockResponse);
    });

    it('handles errors', async () => {
      const error = new Error('Deny Failed');
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      await expect(
        linkedBusinessesService.denyLinkInvite('id', mockToken),
      ).rejects.toThrow('Deny Failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LinkedBusinesses] Failed to deny invite:',
        error,
      );
    });
  });

  describe('revokeLinkedBusiness', () => {
    it('revokes business link successfully', async () => {
      const linkId = 'link-789';
      const mockResponse = { success: true };
      (apiClient.delete as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await linkedBusinessesService.revokeLinkedBusiness(linkId, mockToken);

      expect(apiClient.delete).toHaveBeenCalledWith(
        `/v1/companion-organisation/revoke/${linkId}`,
        { headers: mockHeaders },
      );
      expect(result).toEqual(mockResponse);
    });

    it('handles errors', async () => {
      const error = new Error('Revoke Failed');
      (apiClient.delete as jest.Mock).mockRejectedValue(error);

      await expect(
        linkedBusinessesService.revokeLinkedBusiness('id', mockToken),
      ).rejects.toThrow('Revoke Failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LinkedBusinesses] Failed to revoke business:',
        error,
      );
    });
  });
});