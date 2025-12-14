import {
  fetchChatToken,
  createOrFetchChatSession,
} from '../../../../src/features/chat/services/chatBackendService';
import apiClient from '../../../../src/shared/services/apiClient';
import { getFreshStoredTokens } from '../../../../src/features/auth/sessionManager';

// --- Mocks ---
jest.mock('../../../../src/shared/services/apiClient');
jest.mock('../../../../src/features/auth/sessionManager');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockGetTokens = getFreshStoredTokens as jest.Mock;

describe('chatBackendService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
  });

  // ===========================================================================
  // 1. fetchChatToken
  // ===========================================================================

  describe('fetchChatToken', () => {
    it('should build headers with auth token if available', async () => {
      mockGetTokens.mockResolvedValue({ accessToken: 'valid-token' });
      mockApiClient.post.mockResolvedValue({ data: { token: 'chat-token-123' } });

      const token = await fetchChatToken();
      expect(token).toBe('chat-token-123');
    });

    it('should proceed without auth headers and warn if token missing', async () => {
      mockGetTokens.mockResolvedValue(null); // No token
      mockApiClient.post.mockResolvedValue({ data: { token: 'public-token' } });

      await fetchChatToken();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing access token')
      );
      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/token'),
        undefined,
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    // --- Token Extraction Logic (Branch Coverage) ---
    it('should extract token from various response shapes', async () => {
      mockGetTokens.mockResolvedValue({ accessToken: 't' });

      // 1. data.token
      mockApiClient.post.mockResolvedValueOnce({ data: { token: 'A' } });
      expect(await fetchChatToken()).toBe('A');

      // 2. data.streamToken
      mockApiClient.post.mockResolvedValueOnce({ data: { streamToken: 'B' } });
      expect(await fetchChatToken()).toBe('B');

      // 3. data.chatToken
      mockApiClient.post.mockResolvedValueOnce({ data: { chatToken: 'C' } });
      expect(await fetchChatToken()).toBe('C');

      // 4. data.accessToken
      mockApiClient.post.mockResolvedValueOnce({ data: { accessToken: 'D' } });
      expect(await fetchChatToken()).toBe('D');

      // 5. data.data.token (Nested)
      mockApiClient.post.mockResolvedValueOnce({ data: { data: { token: 'E' } } });
      expect(await fetchChatToken()).toBe('E');
    });

    it('should throw error if response is empty', async () => {
        mockGetTokens.mockResolvedValue({ accessToken: 't' });
        mockApiClient.post.mockResolvedValue({ data: null });

        await expect(fetchChatToken()).rejects.toThrow('Chat token missing from backend response');
    });

    it('should throw error if token is null in extraction', async () => {
      mockGetTokens.mockResolvedValue({ accessToken: 't' });
      mockApiClient.post.mockResolvedValue({ data: { otherField: '123' } }); // No recognized token field

      await expect(fetchChatToken()).rejects.toThrow('Chat token missing from backend response');
    });

    // --- Error Handling ---
    it('should handle API errors and extract message', async () => {
      mockGetTokens.mockResolvedValue({ accessToken: 't' });

      // Case 1: error.response.data.message
      mockApiClient.post.mockRejectedValue({
        response: { data: { message: 'Server Error' } }
      });
      await expect(fetchChatToken()).rejects.toThrow('Server Error');

      // Case 2: error.response.data.error
      mockApiClient.post.mockRejectedValue({
        response: { data: { error: 'Bad Request' } }
      });
      await expect(fetchChatToken()).rejects.toThrow('Bad Request');

      // Case 3: error.message (Standard Error)
      mockApiClient.post.mockRejectedValue(new Error('Network Fail'));
      await expect(fetchChatToken()).rejects.toThrow('Network Fail');

      // Case 4: Default fallback
      mockApiClient.post.mockRejectedValue({});
      await expect(fetchChatToken()).rejects.toThrow('Failed to fetch chat token');
    });
  });

  // ===========================================================================
  // 2. createOrFetchChatSession
  // ===========================================================================

  describe('createOrFetchChatSession', () => {
    const sessionParams = { sessionId: 'sess-123' };

    it('should create session and map response fields correctly', async () => {
      mockGetTokens.mockResolvedValue({ accessToken: 't' });

      const mockResponseData = {
        channelId: 'chan-1',
        channelType: 'messaging',
        members: ['user-1', { user: { id: 'user-2' } }],
        status: 'active',
        allowedFrom: '2023-01-01',
        allowedUntil: '2023-12-31',
        companionId: 'comp-1',
        parentId: 'parent-1',
        vetId: 'vet-1',
        appointmentId: 'appt-1',
        organisationId: 'org-1',
      };

      mockApiClient.post.mockResolvedValue({ data: mockResponseData });

      const result = await createOrFetchChatSession(sessionParams);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/sess-123'),
        undefined,
        expect.anything()
      );

      expect(result).toEqual({
        channelId: 'chan-1',
        channelType: 'messaging',
        members: ['user-1', 'user-2'],
        status: 'active',
        allowedFrom: '2023-01-01',
        allowedUntil: '2023-12-31',
        companionId: 'comp-1',
        parentId: 'parent-1',
        vetId: 'vet-1',
        appointmentId: 'appt-1',
        organisationId: 'org-1',
        raw: mockResponseData,
      });
    });

    // --- Channel ID Extraction Logic ---
    it('should extract channelId from various response paths', async () => {
       mockGetTokens.mockResolvedValue({ accessToken: 't' });

       // 1. data.cid (format 'type:id')
       mockApiClient.post.mockResolvedValueOnce({ data: { cid: 'messaging:cid-1' } });
       expect((await createOrFetchChatSession(sessionParams)).channelId).toBe('cid-1');

       // 2. data.channel.cid
       mockApiClient.post.mockResolvedValueOnce({ data: { channel: { cid: 'messaging:cid-2' } } });
       expect((await createOrFetchChatSession(sessionParams)).channelId).toBe('cid-2');

       // 3. data.channel_id
       mockApiClient.post.mockResolvedValueOnce({ data: { channel_id: 'cid-3' } });
       expect((await createOrFetchChatSession(sessionParams)).channelId).toBe('cid-3');

       // 4. data.id
       mockApiClient.post.mockResolvedValueOnce({ data: { id: 'cid-4' } });
       expect((await createOrFetchChatSession(sessionParams)).channelId).toBe('cid-4');

       // 5. data.channel.id
       mockApiClient.post.mockResolvedValueOnce({ data: { channel: { id: 'cid-5' } } });
       expect((await createOrFetchChatSession(sessionParams)).channelId).toBe('cid-5');

       // 6. data.session.channelId
       mockApiClient.post.mockResolvedValueOnce({ data: { session: { channelId: 'cid-6' } } });
       expect((await createOrFetchChatSession(sessionParams)).channelId).toBe('cid-6');
    });

    // --- Channel Type Extraction Logic ---
    it('should extract channelType from various response paths and default to messaging', async () => {
        mockGetTokens.mockResolvedValue({ accessToken: 't' });

        // 1. data.channelType
        mockApiClient.post.mockResolvedValueOnce({ data: { channelId: '1', channelType: 'livestream' } });
        expect((await createOrFetchChatSession(sessionParams)).channelType).toBe('livestream');

        // 2. data.channel_type
        mockApiClient.post.mockResolvedValueOnce({ data: { channelId: '1', channel_type: 'commerce' } });
        expect((await createOrFetchChatSession(sessionParams)).channelType).toBe('commerce');

        // 3. From CID (messaging:id)
        mockApiClient.post.mockResolvedValueOnce({ data: { cid: 'custom:123' } });
        expect((await createOrFetchChatSession(sessionParams)).channelType).toBe('custom');

        // 4. Default
        mockApiClient.post.mockResolvedValueOnce({ data: { channelId: '1' } }); // No type info
        expect((await createOrFetchChatSession(sessionParams)).channelType).toBe('messaging');
    });

    // --- Members Extraction Logic ---
    it('should extract and normalize members', async () => {
        mockGetTokens.mockResolvedValue({ accessToken: 't' });

        const complexMembers = {
            channelId: '1',
            members: [
                'simple-id',
                { user: { id: 'user-obj-id' } },
                { user_id: 'snake-case-id' },
                { id: 'direct-id' },
                null, // Should be filtered out
                { unknown: 'obj' } // Should resolve to null then filtered out
            ]
        };

        mockApiClient.post.mockResolvedValue({ data: complexMembers });
        const result = await createOrFetchChatSession(sessionParams);

        expect(result.members).toEqual([
            'simple-id',
            'user-obj-id',
            'snake-case-id',
            'direct-id'
        ]);
    });

    it('should return undefined members if array is invalid or empty', async () => {
         mockGetTokens.mockResolvedValue({ accessToken: 't' });

         // Not an array
         mockApiClient.post.mockResolvedValueOnce({ data: { channelId: '1', members: 'not-array' } });
         expect((await createOrFetchChatSession(sessionParams)).members).toBeUndefined();

         // Empty after filter
         mockApiClient.post.mockResolvedValueOnce({ data: { channelId: '1', members: [null, undefined] } });
         expect((await createOrFetchChatSession(sessionParams)).members).toBeUndefined();
    });

    // --- Null Handling ---
    it('should handle null data response gracefully but throw for missing ID', async () => {
        mockGetTokens.mockResolvedValue({ accessToken: 't' });
        mockApiClient.post.mockResolvedValue({ data: null });

        await expect(createOrFetchChatSession(sessionParams))
            .rejects.toThrow('Channel ID missing from chat session response');
    });

    it('should handle missing allowedFrom/allowedUntil (null checks)', async () => {
         mockGetTokens.mockResolvedValue({ accessToken: 't' });
         mockApiClient.post.mockResolvedValue({ data: { channelId: '1' } }); // Missing optional fields

         const result = await createOrFetchChatSession(sessionParams);
         expect(result.allowedFrom).toBeNull();
         expect(result.allowedUntil).toBeNull();
    });

    // --- Error Handling ---
    it('should handle API errors and extract message', async () => {
      mockGetTokens.mockResolvedValue({ accessToken: 't' });

      mockApiClient.post.mockRejectedValue({
        response: { data: { message: 'Session Error' } }
      });
      await expect(createOrFetchChatSession(sessionParams)).rejects.toThrow('Session Error');

      mockApiClient.post.mockRejectedValue({});
      await expect(createOrFetchChatSession(sessionParams)).rejects.toThrow('Failed to create chat session');
    });
  });
});