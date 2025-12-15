import { StreamChat } from 'stream-chat';

// Mock the chatService API calls
jest.mock('@/app/services/chatService', () => ({
  getChatToken: jest.fn(() => Promise.resolve({ token: 'test-token' })),
  createChatSession: jest.fn(() =>
    Promise.resolve({ channelId: 'test-channel-id' })
  ),
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
  let service: typeof import('../../services/streamChatService');
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
      enumerable: true
    });
    mockClient.user = undefined;

    service = await import('../../services/streamChatService');
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
      service = await import('../../services/streamChatService');

  expect(() => service.getChatClient()).toThrow(/Failed to initialize chat client/);
    });
  });

  describe('connectStreamUser', () => {
    it('connects a new user successfully', async () => {
      await service.connectStreamUser('user-1', 'User One');

      expect(mockClient.connectUser).toHaveBeenCalledWith(
        { id: 'user-1', name: 'User One' },
        'test-token'
      );
    });

    it('connects a new user with image', async () => {
      await service.connectStreamUser('user-1', 'User One', 'image-url');

      expect(mockClient.connectUser).toHaveBeenCalledWith(
        { id: 'user-1', name: 'User One', image: 'image-url' },
        'test-token'
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
        expect.any(String)
      );
    });

    it('handles connection errors', async () => {
      mockClient.connectUser.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(service.connectStreamUser('user-1', 'User One'))
        .rejects.toThrow(/Failed to connect to chat/);
    });
  });

  describe('disconnectStreamUser', () => {
    it('disconnects user if client has a userID', async () => {
      service.getChatClient();
      mockClient.userID = 'user-1';

      await service.disconnectStreamUser();

      expect(mockClient.disconnectUser).toHaveBeenCalled();
    });

    it('does nothing if no user is connected', async () => {
      service.getChatClient();
      mockClient.userID = undefined;

      await service.disconnectStreamUser();

      expect(mockClient.disconnectUser).not.toHaveBeenCalled();
    });

    it('handles disconnection errors silently', async () => {
      service.getChatClient();
      mockClient.userID = 'user-1';
      mockClient.disconnectUser.mockRejectedValueOnce(new Error('Logout failed'));

  await expect(service.disconnectStreamUser()).rejects.toThrow('Failed to properly disconnect from chat service');
  expect(mockClient.disconnectUser).toHaveBeenCalled();
    });
  });

  describe('getAppointmentChannel', () => {
    it('throws error if user is not connected', async () => {
      service.getChatClient();
      mockClient.userID = undefined;

      await expect(service.getAppointmentChannel('appt-1'))
        .rejects.toThrow('User must be connected before accessing channels');
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

      await expect(service.getAppointmentChannel('appt-1'))
        .rejects.toThrow(/Failed to access chat for appointment/);
    });
  });

  describe('markChannelAsRead', () => {
    it('marks channel as read successfully', async () => {
      await service.markChannelAsRead('chan-1');

      expect(mockClient.channel).toHaveBeenCalledWith('messaging', 'chan-1');
      expect(mockChannel.markRead).toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
      mockChannel.markRead.mockRejectedValueOnce(new Error('Read failed'));

  await expect(service.markChannelAsRead('chan-1')).rejects.toThrow('Failed to mark messages as read');
  expect(mockChannel.markRead).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('returns 0 if user is not connected', async () => {
      service.getChatClient();
      mockClient.userID = undefined;

      const count = await service.getUnreadCount();

      expect(count).toBe(0);
    });

    it('returns total unread count from user object', async () => {
      service.getChatClient();
      mockClient.userID = 'user-1';
      mockClient.user = { total_unread_count: 5 };

      const count = await service.getUnreadCount();

      expect(count).toBe(5);
    });

    it('returns 0 if user object has no count', async () => {
      service.getChatClient();
      mockClient.userID = 'user-1';
      mockClient.user = {};

      const count = await service.getUnreadCount();

      expect(count).toBe(0);
    });

    it('handles errors by returning 0', async () => {
      // Simulate Stream library throwing during client initialization
      jest.spyOn(StreamChat, 'getInstance').mockImplementation(() => {
        throw new Error('Access error');
      });

      const count = await service.getUnreadCount();

      expect(count).toBe(0);
    });
  });

  describe('sendMessage', () => {
    it('sends message to specified channel', async () => {
      await service.sendMessage('chan-1', 'Hello World');

      expect(mockClient.channel).toHaveBeenCalledWith('messaging', 'chan-1');
      expect(mockChannel.sendMessage).toHaveBeenCalledWith({
        text: 'Hello World',
      });
    });

    it('throws error if sending fails', async () => {
      mockChannel.sendMessage.mockRejectedValueOnce(new Error('Send failed'));

  await expect(service.sendMessage('chan-1', 'Hi')).rejects.toThrow(/Failed to send message/);
    });
  });

  describe('endChatChannel', () => {
    it('calls closeChatSession with sessionId', async () => {
  const { closeChatSession } = jest.requireMock('@/app/services/chatService');

      await service.endChatChannel('session-1');

      expect(closeChatSession).toHaveBeenCalledWith('session-1');
    });

    it('throws error if close fails', async () => {
  const { closeChatSession } = jest.requireMock('@/app/services/chatService');
      closeChatSession.mockRejectedValueOnce(new Error('Close failed'));

  await expect(service.endChatChannel('session-1')).rejects.toThrow(/Failed to end chat session/);
    });
  });

  describe('isClientConnected', () => {
    it('returns true if userID exists', () => {
      service.getChatClient();
      mockClient.userID = 'user-1';

      expect(service.isClientConnected()).toBe(true);
    });

    it('returns false if userID is missing', () => {
      service.getChatClient();
      mockClient.userID = undefined;

      expect(service.isClientConnected()).toBe(false);
    });
  });

  describe('getCurrentUserId', () => {
    it('returns userID if connected', () => {
      service.getChatClient();
      mockClient.userID = 'user-123';

      expect(service.getCurrentUserId()).toBe('user-123');
    });

    it('returns undefined if not connected', () => {
      service.getChatClient();
      mockClient.userID = undefined;

      expect(service.getCurrentUserId()).toBeUndefined();
    });
  });
});