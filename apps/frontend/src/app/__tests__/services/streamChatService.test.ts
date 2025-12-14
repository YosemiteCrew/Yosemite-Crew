import { StreamChat } from 'stream-chat';

// --- Mocks ---

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
  devToken: jest.fn((id) => `dev-token-${id}`),
  channel: jest.fn(() => mockChannel),
};

// Mock the stream-chat library
// We use a factory function so we can modify the implementation if needed
jest.mock('stream-chat', () => ({
  StreamChat: {
    getInstance: jest.fn(() => mockClient),
  },
}));

describe('streamChatService', () => {
  // We explicitly type service as 'any' to access exported functions dynamically
  // after re-importing the module in beforeEach.
  let service: typeof import('../../services/streamChatService');
  const originalEnv = process.env;

  beforeEach(async () => {
    // 1. Reset modules to clear the internal 'chatClient' singleton variable
    jest.resetModules();

    // 2. Reset process.env
    process.env = { ...originalEnv, NEXT_PUBLIC_STREAM_API_KEY: 'test-key' };

    // 3. Reset mock state
    jest.clearAllMocks();

    // 4. Reset properties on mockClient (handling potential getters set by previous tests)
    Object.defineProperty(mockClient, 'userID', {
      value: undefined,
      writable: true,
      configurable: true,
      enumerable: true
    });
    mockClient.user = undefined;

    // 5. Re-import the service under test using dynamic import
    service = await import('../../services/streamChatService');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ===========================================================================
  // 1. Initialization & API Key
  // ===========================================================================

  describe('getChatClient', () => {

    it('returns the existing client instance on subsequent calls', () => {
      // First call initializes
      const client1 = service.getChatClient();

      // Reset mocks to ensure we verify the singleton behavior (no second call to getInstance)
      (StreamChat.getInstance as jest.Mock).mockClear();

      // Second call returns singleton
      const client2 = service.getChatClient();

      expect(StreamChat.getInstance).not.toHaveBeenCalled(); // Singleton check
      expect(client1).toBe(client2);
    });

    it('throws error if API key is missing', async () => {
      // Reset module again to clear the singleton from beforeEach
      jest.resetModules();
      process.env.NEXT_PUBLIC_STREAM_API_KEY = '';

      // Re-import service to get a fresh instance with empty key
      service = await import('../../services/streamChatService');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => service.getChatClient()).toThrow('Stream API Key not configured');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Key not found')
      );
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 2. User Connection
  // ===========================================================================

  describe('connectStreamUser', () => {
    it('connects a new user successfully with a dev token (default)', async () => {
      await service.connectStreamUser('user-1', 'User One', 'image-url');

      expect(mockClient.devToken).toHaveBeenCalledWith('user-1');
      expect(mockClient.connectUser).toHaveBeenCalledWith(
        { id: 'user-1', name: 'User One', image: 'image-url' },
        'dev-token-user-1'
      );
    });

    it('connects a new user with a provided token', async () => {
      await service.connectStreamUser('user-1', 'User One', undefined, 'server-token');

      expect(mockClient.devToken).not.toHaveBeenCalled();
      expect(mockClient.connectUser).toHaveBeenCalledWith(
        { id: 'user-1', name: 'User One' },
        'server-token'
      );
    });

    it('returns existing client immediately if the same user is already connected', async () => {
      // Simulate connected state
      mockClient.userID = 'user-1';

      await service.connectStreamUser('user-1', 'User One');

      expect(mockClient.disconnectUser).not.toHaveBeenCalled();
      expect(mockClient.connectUser).not.toHaveBeenCalled();
    });

    it('disconnects previous user before connecting new user', async () => {
      // Simulate different user connected
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
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.connectStreamUser('user-1', 'User One'))
        .rejects.toThrow('Failed to connect to chat. Please try again.');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('disconnectStreamUser', () => {
    it('disconnects user if client has a userID', async () => {
      // Initialize client first
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

    it('handles disconnection errors', async () => {
      service.getChatClient();
      mockClient.userID = 'user-1';
      mockClient.disconnectUser.mockRejectedValueOnce(new Error('Logout failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.disconnectStreamUser(); // Should not throw, just log

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to disconnect user'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 3. Channel Management
  // ===========================================================================

  describe('getAppointmentChannel', () => {
    it('throws error if user is not connected', async () => {
      service.getChatClient();
      mockClient.userID = undefined;

      await expect(service.getAppointmentChannel('appt-1', 'owner-1'))
        .rejects.toThrow('User must be connected before accessing channels');
    });

    it('creates/retrieves channel with correct parameters and watches it', async () => {
      service.getChatClient();
      mockClient.userID = 'vet-1';

      const apptData = {
        petOwnerName: 'Alice',
        appointmentTime: '10:00 AM',
        petName: 'Fido',
      };

      const result = await service.getAppointmentChannel('appt-1', 'owner-1', apptData);

      expect(mockClient.channel).toHaveBeenCalledWith('messaging', 'appointment-appt-1', {
        name: 'Chat with Alice',
        members: ['vet-1', 'owner-1'],
        appointmentId: 'appt-1',
        appointmentTime: '10:00 AM',
        petName: 'Fido',
        activationMinutes: 5,
        status: 'active',
      });
      expect(mockChannel.watch).toHaveBeenCalled();
      expect(result).toBe(mockChannel);
    });

    it('uses default name if petOwnerName is missing', async () => {
      service.getChatClient();
      mockClient.userID = 'vet-1';

      await service.getAppointmentChannel('appt-1', 'owner-1', {});

      expect(mockClient.channel).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ name: 'Chat with Pet Owner' })
      );
    });
  });

  describe('endChatChannel', () => {
    it('sends a system message and updates channel status to ended', async () => {
      await service.endChatChannel('chan-1');

      expect(mockClient.channel).toHaveBeenCalledWith('messaging', 'chan-1');

      // 1. Check system message
      expect(mockChannel.sendMessage).toHaveBeenCalledWith({
        text: expect.stringContaining('This chat has been ended'),
        user_id: 'system',
      });

      // 2. Check status update
      expect(mockChannel.updatePartial).toHaveBeenCalledWith({
        set: { status: 'ended' },
      });
    });

    it('handles errors when ending chat', async () => {
      mockChannel.sendMessage.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.endChatChannel('chan-1')).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to end channel'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 4. Messaging & Utils
  // ===========================================================================

  describe('markChannelAsRead', () => {
    it('marks channel as read successfully', async () => {
      await service.markChannelAsRead('chan-1');
      expect(mockClient.channel).toHaveBeenCalledWith('messaging', 'chan-1');
      expect(mockChannel.markRead).toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
      mockChannel.markRead.mockRejectedValueOnce(new Error('Read failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.markChannelAsRead('chan-1'); // Should catch error internally

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to mark channel as read'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
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

    it('returns 0 if user object is missing count', async () => {
      service.getChatClient();
      mockClient.userID = 'user-1';
      mockClient.user = {}; // No count property

      const count = await service.getUnreadCount();
      expect(count).toBe(0);
    });

    it('handles errors by returning 0', async () => {
      // Instead of spying on the service (which fails on exports),
      // we make the property access throw by redefining the property on the mock object.
      Object.defineProperty(mockClient, 'userID', {
        get: () => { throw new Error('Simulated access error'); },
        configurable: true
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const count = await service.getUnreadCount();

      expect(count).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get unread count'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
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
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.sendMessage('chan-1', 'Hi')).rejects.toThrow('Send failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send message'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
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

    it('returns false if client is null', async () => {
      // client defaults to null on module load before getChatClient is called
      // We need to re-import to test the initial null state logic
      jest.resetModules();
      const freshService = await import('../../services/streamChatService');
      expect(freshService.isClientConnected()).toBe(false);
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