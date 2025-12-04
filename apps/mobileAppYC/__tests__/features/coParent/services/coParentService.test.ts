import { coParentApi } from '../../../../src/features/coParent/services/coParentService';
import apiClient from '@/shared/services/apiClient';

// Mock the API Client and helper
jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  withAuthHeaders: jest.fn((token) => ({ Authorization: `Bearer ${token}` })),
}));

describe('coParentService', () => {
  const mockAccessToken = 'mock-token';
  const mockAuthHeaders = { headers: { Authorization: `Bearer ${mockAccessToken}` } };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendInvite', () => {
    const baseParams = {
      inviteeName: 'John Doe',
      email: 'john@example.com',
      companionId: 'comp-123',
      accessToken: mockAccessToken,
    };

    it('sends invite with phone number', async () => {
      const mockResponse = { success: true };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await coParentApi.sendInvite({
        ...baseParams,
        phoneNumber: '1234567890',
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/coparent-invite/sent',
        {
          inviteeName: 'John Doe',
          email: 'john@example.com',
          companionId: 'comp-123',
          phoneNumber: '1234567890',
        },
        mockAuthHeaders
      );
      expect(result).toEqual(mockResponse);
    });

    it('sends invite without phone number', async () => {
      const mockResponse = { success: true };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await coParentApi.sendInvite(baseParams);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/coparent-invite/sent',
        {
          inviteeName: 'John Doe',
          email: 'john@example.com',
          companionId: 'comp-123',
        },
        mockAuthHeaders
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listPendingInvites', () => {
    it('returns pendingInvites property if present', async () => {
      const mockInvites = [{ id: 'inv-1' }];
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { pendingInvites: mockInvites }
      });

      const result = await coParentApi.listPendingInvites({ accessToken: mockAccessToken });
      expect(result).toEqual(mockInvites);
      expect(apiClient.get).toHaveBeenCalledWith('/v1/coparent-invite/pending', mockAuthHeaders);
    });

    it('returns data directly if pendingInvites is missing (fallback)', async () => {
      const mockInvites = [{ id: 'inv-2' }];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockInvites });

      const result = await coParentApi.listPendingInvites({ accessToken: mockAccessToken });
      expect(result).toEqual(mockInvites);
    });

    it('returns empty array if data is null/undefined', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });

      const result = await coParentApi.listPendingInvites({ accessToken: mockAccessToken });
      expect(result).toEqual([]);
    });
  });

  describe('acceptInvite', () => {
    it('calls accept endpoint and returns token', async () => {
      const token = 'invite-token-123';
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const result = await coParentApi.acceptInvite({ token, accessToken: mockAccessToken });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/coparent-invite/accept',
        { token },
        mockAuthHeaders
      );
      expect(result).toBe(token);
    });
  });

  describe('declineInvite', () => {
    it('calls decline endpoint and returns token', async () => {
      const token = 'invite-token-123';
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const result = await coParentApi.declineInvite({ token, accessToken: mockAccessToken });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/coparent-invite/decline',
        { token },
        mockAuthHeaders
      );
      expect(result).toBe(token);
    });
  });

  describe('listByCompanion', () => {
    const companionId = 'comp-1';

    it('returns links property if present', async () => {
      const mockLinks = [{ id: 'link-1' }];
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { links: mockLinks }
      });

      const result = await coParentApi.listByCompanion({ companionId, accessToken: mockAccessToken });
      expect(result).toEqual(mockLinks);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/v1/parent-companion/companion/${companionId}`,
        mockAuthHeaders
      );
    });

    it('returns data directly if links is missing', async () => {
      const mockData = [{ id: 'link-2' }];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockData });

      const result = await coParentApi.listByCompanion({ companionId, accessToken: mockAccessToken });
      expect(result).toEqual(mockData);
    });

    it('returns empty array if data is null', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });

      const result = await coParentApi.listByCompanion({ companionId, accessToken: mockAccessToken });
      expect(result).toEqual([]);
    });
  });

  describe('listByParent', () => {
    const parentId = 'parent-1';

    it('returns links property if present', async () => {
      const mockLinks = [{ id: 'link-1' }];
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { links: mockLinks }
      });

      const result = await coParentApi.listByParent({ parentId, accessToken: mockAccessToken });
      expect(result).toEqual(mockLinks);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/v1/parent-companion/parent/${parentId}`,
        mockAuthHeaders
      );
    });

    it('returns data directly if links is missing', async () => {
      const mockData = [{ id: 'link-2' }];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockData });

      const result = await coParentApi.listByParent({ parentId, accessToken: mockAccessToken });
      expect(result).toEqual(mockData);
    });

    it('returns empty array if data is null', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });

      const result = await coParentApi.listByParent({ parentId, accessToken: mockAccessToken });
      expect(result).toEqual([]);
    });
  });

  describe('updatePermissions', () => {
    it('calls update permissions endpoint', async () => {
      const params = {
        companionId: 'c1',
        coParentId: 'cp-1',
        permissions: { tasks: true } as any,
        accessToken: mockAccessToken,
      };
      const mockResponse = { success: true };
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockResponse });

      const result = await coParentApi.updatePermissions(params);

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/v1/parent-companion/c1/cp-1/permissions',
        params.permissions,
        mockAuthHeaders
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('promoteToPrimary', () => {
    it('calls promote endpoint', async () => {
      const params = {
        companionId: 'c1',
        coParentId: 'cp-1',
        accessToken: mockAccessToken,
      };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      const result = await coParentApi.promoteToPrimary(params);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/parent-companion/c1/cp-1/promote',
        {},
        mockAuthHeaders
      );
      expect(result).toBe(true);
    });
  });

  describe('remove', () => {
    it('calls remove endpoint', async () => {
      const params = {
        companionId: 'c1',
        coParentId: 'cp-1',
        accessToken: mockAccessToken,
      };
      (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });

      const result = await coParentApi.remove(params);

      expect(apiClient.delete).toHaveBeenCalledWith(
        '/v1/parent-companion/c1/cp-1',
        mockAuthHeaders
      );
      expect(result).toBe(true);
    });
  });
});