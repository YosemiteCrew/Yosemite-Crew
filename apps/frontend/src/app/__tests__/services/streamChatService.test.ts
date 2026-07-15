import { StreamChat } from 'stream-chat';

// Mock the chatService API calls
jest.mock('@/app/features/chat/services/chatService', () => ({
  getChatToken: jest.fn(() => Promise.resolve({ token: 'test-token' })),
  createChatSession: jest.fn(() => Promise.resolve({ channelId: 'test-channel-id' })),
  closeChatSession: jest.fn(() => Promise.resolve({})),
}));

// Mock Channel object returned by client.channel()
const mockChannel = {
  watch: jest.fn().mockResolvedValue(undefined),
  markRead: jest.fn().mockResolvedValue(undefined),
  sendMessage: jest.fn().mockResolvedValue({ message: { id: 'msg-1' } }),
  updatePartial: jest.fn().mockResolvedValue(undefined),
};

// Mock Client object returned by StreamChat.getInstance()
const mockClient: any = {
  userID: undefined as string | undefined,
  user: undefined as { total_unread_count?: number } | undefined,
  connectUser: jest.fn().mockResolvedValue(undefined),
  disconnectUser: jest.fn().mockResolvedValue(undefined),
  channel: jest.fn(() => mockChannel),
};

// Mock the stream-chat library
jest.mock('stream-chat', () => ({
  StreamChat: {
    getInstance: jest.fn(() => mockClient),
  },
}));

describe('streamChatService', () => {
  let service: typeof import('@/app/features/chat/services/streamChatService');
  const originalEnv = process.env;

  // silence console warnings/errors for this test suite (jest.setup throws on them)
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
  });
  afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...originalEnv, NEXT_PUBLIC_STREAM_API_KEY: 'test-key' };
    jest.clearAllMocks();

    Object.defineProperty(mockClient, 'userID', {
      value: undefined,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    mockClient.user = undefined;

    service = await import('@/app/features/chat/services/streamChatService');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getChatClient', () => {
    it('returns the existing client instance on subsequent calls', () => {
      const client1 = service.getChatClient();
      (StreamChat.getInstance as jest.Mock).mockClear();
      const client2 = service.getChatClient();

      expect(StreamChat.getInstance).not.toHaveBeenCalled();
      expect(client1).toBe(client2);
    });

    it('throws error if API key is missing', async () => {
      jest.resetModules();
      process.env.NEXT_PUBLIC_STREAM_API_KEY = '';
      service = await import('@/app/features/chat/services/streamChatService');

      expect(() => service.getChatClient()).toThrow(/Failed to initialize chat client/);
    });
  });

  describe('connectStreamUser', () => {
    it('connects a new user successfully', async () => {
      await service.connectStreamUser('user-1', 'User One');

      expect(mockClient.connectUser).toHaveBeenCalledWith(
        { id: 'user-1', name: 'User One' },
        expect.any(Function)
      );
      // The token provider resolves to the backend token (enables auto-refresh).
      const tokenProvider = mockClient.connectUser.mock.calls[0][1] as () => Promise<string>;
      await expect(tokenProvider()).resolves.toBe('test-token');
    });

    it('connects a new user with image', async () => {
      await service.connectStreamUser('user-1', 'User One', 'image-url');

      expect(mockClient.connectUser).toHaveBeenCalledWith(
        { id: 'user-1', name: 'User One', image: 'image-url' },
        expect.any(Function)
      );
    });

    it('returns existing client if same user already connected', async () => {
      mockClient.userID = 'user-1';

      await service.connectStreamUser('user-1', 'User One');

      expect(mockClient.disconnectUser).not.toHaveBeenCalled();
      expect(mockClient.connectUser).not.toHaveBeenCalled();
    });

    it('disconnects previous user before connecting new user', async () => {
      mockClient.userID = 'old-user';

      await service.connectStreamUser('new-user', 'New User');

      expect(mockClient.disconnectUser).toHaveBeenCalled();
      expect(mockClient.connectUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-user' }),
        expect.any(Function)
      );
    });

    it('handles connection errors', async () => {
      mockClient.connectUser.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(service.connectStreamUser('user-1', 'User One')).rejects.toThrow(
        /Failed to connect to chat/
      );
    });

    it('throws if userId is empty string', async () => {
      await expect(service.connectStreamUser('', 'User One')).rejects.toThrow(
        'Invalid user ID provided for connection'
      );
    });

    it('throws if userName is empty string', async () => {
      await expect(service.connectStreamUser('user-1', '')).rejects.toThrow(
        'Invalid user name provided for connection'
      );
    });

    it('handles disconnect failure when switching users', async () => {
      mockClient.userID = 'old-user';
      mockClient.disconnectUser.mockRejectedValueOnce(new Error('Disconnect failed'));

      // Should still attempt to connect even after disconnect failure
      await service.connectStreamUser('new-user', 'New User');
      expect(mockClient.connectUser).toHaveBeenCalled();
    });

    it('handles non-Error thrown during connection', async () => {
      mockClient.connectUser.mockRejectedValueOnce('string-error');

      await expect(service.connectStreamUser('user-1', 'User One')).rejects.toThrow(
        'Failed to connect to chat. Please try again.'
      );
    });
  });

  describe('getAppointmentChannel', () => {
    it('throws error if user is not connected', async () => {
      service.getChatClient();
      mockClient.userID = undefined;

      await expect(service.getAppointmentChannel('appt-1')).rejects.toThrow(
        'User must be connected before accessing channels'
      );
    });

    it('creates/retrieves channel and watches it', async () => {
      service.getChatClient();
      mockClient.userID = 'vet-1';

      const result = await service.getAppointmentChannel('appt-1');

      expect(mockClient.channel).toHaveBeenCalled();
      expect(mockChannel.watch).toHaveBeenCalled();
      expect(result).toBe(mockChannel);
    });

    it('handles errors during channel access', async () => {
      service.getChatClient();
      mockClient.userID = 'vet-1';
      mockClient.channel.mockImplementationOnce(() => {
        throw new Error('Channel error');
      });

      await expect(service.getAppointmentChannel('appt-1')).rejects.toThrow(
        /Failed to access chat for appointment/
      );
    });

    it('throws for invalid appointment ID', async () => {
      service.getChatClient();
      mockClient.userID = 'vet-1';
      await expect(service.getAppointmentChannel('')).rejects.toThrow(
        'Invalid appointment ID provided'
      );
    });

    it('handles non-Error thrown during channel access', async () => {
      service.getChatClient();
      mockClient.userID = 'vet-1';
      mockClient.channel.mockImplementationOnce(() => {
        throw 'non-error-string';
      });

      await expect(service.getAppointmentChannel('appt-1')).rejects.toThrow(
        'Failed to access chat for this appointment'
      );
    });
  });

  describe('endChatChannel', () => {
    it('calls closeChatSession with sessionId', async () => {
      const { closeChatSession } = jest.requireMock('@/app/features/chat/services/chatService');

      await service.endChatChannel('session-1');

      expect(closeChatSession).toHaveBeenCalledWith('session-1');
    });

    it('throws error if close fails', async () => {
      const { closeChatSession } = jest.requireMock('@/app/features/chat/services/chatService');
      closeChatSession.mockRejectedValueOnce(new Error('Close failed'));

      await expect(service.endChatChannel('session-1')).rejects.toThrow(
        /Failed to end chat session/
      );
    });

    it('throws for invalid session ID', async () => {
      await expect(service.endChatChannel('')).rejects.toThrow('Invalid session ID provided');
    });

    it('handles non-Error thrown during end chat', async () => {
      const { closeChatSession } = jest.requireMock('@/app/features/chat/services/chatService');
      closeChatSession.mockRejectedValueOnce('non-error');
      await expect(service.endChatChannel('session-1')).rejects.toThrow(
        'Failed to end chat session due to an unknown error'
      );
    });
  });
});
