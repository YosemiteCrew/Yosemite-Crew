import { StreamChat } from 'stream-chat';
// FIX 1: Use relative paths to ensure module resolution works without alias config
import * as chatBackendService from '../../../../src/features/chat/services/chatBackendService';
import type * as StreamChatServiceType from '../../../../src/features/chat/services/streamChatService';

// Mock dependencies globally
jest.mock('stream-chat', () => ({
  StreamChat: {
    getInstance: jest.fn(),
  },
}));

// FIX 1: Use relative path for mock
jest.mock('../../../../src/features/chat/services/chatBackendService', () => ({
  fetchChatToken: jest.fn(),
  createOrFetchChatSession: jest.fn(),
}));

describe('streamChatService', () => {
  let streamChatService: typeof StreamChatServiceType;
  let mockClient: any;
  let mockChannel: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // 1. Setup Mock Channel
    mockChannel = {
      watch: jest.fn().mockResolvedValue({}),
      markRead: jest.fn().mockResolvedValue({}),
      sendMessage: jest.fn().mockResolvedValue({}),
      state: {
        members: {
          'user-1': { user: { id: 'user-1' } },
          'vet-1': { user: { id: 'vet-1' } },
        },
      },
    };

    // 2. Setup Mock Client with mutable properties
    mockClient = {
      userID: null,
      connectUser: jest.fn().mockResolvedValue({}),
      disconnectUser: jest.fn().mockResolvedValue({}),
      devToken: jest.fn().mockReturnValue('dev-token'),
      channel: jest.fn().mockReturnValue(mockChannel),
      user: { total_unread_count: 5 },
    };

    (StreamChat.getInstance as jest.Mock).mockReturnValue(mockClient);

    // 3. Reset the Singleton Module State for every test
    jest.isolateModules(() => {
      // FIX 1: Relative path
      jest.doMock('../../../../src/config/variables', () => ({
        STREAM_CHAT_CONFIG: { apiKey: 'test-api-key' },
      }));
      // FIX 1: Relative path
      streamChatService = require('../../../../src/features/chat/services/streamChatService');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization & Configuration', () => {
    it('initializes StreamChat with configured API key', () => {
      streamChatService.getChatClient();
      expect(StreamChat.getInstance).toHaveBeenCalledWith('test-api-key');
    });

    it('returns the same instance on subsequent calls (Singleton)', () => {
      const client1 = streamChatService.getChatClient();
      const client2 = streamChatService.getChatClient();
      expect(client1).toBe(client2);
      expect(StreamChat.getInstance).toHaveBeenCalledTimes(1);
    });

    it('throws error if API Key is missing', () => {
      // FIX 2: Extract factory to reduce nesting level
      const mockMissingApiKeyConfig = () => ({
        STREAM_CHAT_CONFIG: { apiKey: '' },
      });

      jest.isolateModules(() => {
        // FIX 1: Relative path
        jest.doMock('../../../../src/config/variables', mockMissingApiKeyConfig);
        // FIX 1: Relative path
        const service = require('../../../../src/features/chat/services/streamChatService');
        expect(() => service.getChatClient()).toThrow('Stream API Key not configured');
      });
    });
  });

  describe('Connection Logic', () => {
    it('connects a new user successfully with provided token', async () => {
      await streamChatService.connectStreamUser('user-123', 'John Doe', 'avatar.png', 'valid-token');

      expect(mockClient.connectUser).toHaveBeenCalledWith(
        { id: 'user-123', name: 'John Doe', image: 'avatar.png' },
        'valid-token'
      );
    });

    it('fetches token from backend if not provided', async () => {
      (chatBackendService.fetchChatToken as jest.Mock).mockResolvedValue('backend-token');

      await streamChatService.connectStreamUser('user-123', 'John Doe');

      expect(chatBackendService.fetchChatToken).toHaveBeenCalled();
      expect(mockClient.connectUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-123' }),
        'backend-token'
      );
    });

    it('falls back to dev token if backend token fetch fails', async () => {
      (chatBackendService.fetchChatToken as jest.Mock).mockRejectedValue(new Error('Network Error'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await streamChatService.connectStreamUser('user-123', 'John Doe');

      expect(mockClient.devToken).toHaveBeenCalledWith('user-123');
      expect(mockClient.connectUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-123' }),
        'dev-token'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to fetch chat token'),
          expect.any(Error)
      );
    });

    it('does not reconnect if the same user is already connected', async () => {
      streamChatService.getChatClient();
      mockClient.userID = 'user-123';

      await streamChatService.connectStreamUser('user-123', 'John Doe');

      expect(mockClient.connectUser).not.toHaveBeenCalled();
    });

    it('disconnects existing user before connecting a new one', async () => {
      streamChatService.getChatClient();
      mockClient.userID = 'old-user';

      await streamChatService.connectStreamUser('new-user', 'Jane Doe', undefined, 'token');

      expect(mockClient.disconnectUser).toHaveBeenCalled();
      expect(mockClient.connectUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-user' }),
        'token'
      );
    });

    it('throws error if connection fails', async () => {
      mockClient.connectUser.mockRejectedValue(new Error('Connection Failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(streamChatService.connectStreamUser('u1', 'Name'))
        .rejects.toThrow('Failed to connect to chat');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Disconnection', () => {
    it('disconnects user if connected', async () => {
      streamChatService.getChatClient();
      mockClient.userID = 'user-123';

      await streamChatService.disconnectStreamUser();
      expect(mockClient.disconnectUser).toHaveBeenCalled();
    });

    it('does nothing if no user is connected', async () => {
      streamChatService.getChatClient();
      mockClient.userID = null;

      await streamChatService.disconnectStreamUser();
      expect(mockClient.disconnectUser).not.toHaveBeenCalled();
    });

    it('handles disconnection errors gracefully', async () => {
      streamChatService.getChatClient();
      mockClient.userID = 'user-123';
      mockClient.disconnectUser.mockRejectedValue(new Error('Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await streamChatService.disconnectStreamUser();

      expect(mockClient.disconnectUser).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to disconnect'),
          expect.any(Error)
      );
    });
  });

  describe('Channel Management', () => {
    const appointmentId = 'appt-123';
    const vetId = 'vet-456';
    const data = { doctorName: 'Dr. Smith', dateTime: '2025-01-01', petName: 'Buddy' };

    it('throws error if user is not connected', async () => {
      streamChatService.getChatClient();
      mockClient.userID = null;
      await expect(streamChatService.getAppointmentChannel(appointmentId, vetId))
        .rejects.toThrow('User must be connected');
    });

    it('resolves channel via backend session logic', async () => {
      streamChatService.getChatClient();
      mockClient.userID = 'user-123';

      (chatBackendService.createOrFetchChatSession as jest.Mock).mockResolvedValue({
        channelId: 'custom-channel-id',
        channelType: 'custom-type',
        members: ['user-123', 'vet-456'],
      });

      await streamChatService.getAppointmentChannel(appointmentId, vetId, data);

      expect(chatBackendService.createOrFetchChatSession).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: appointmentId,
        userId: 'user-123',
        vetId: vetId,
      }));

      expect(mockClient.channel).toHaveBeenCalledWith(
        'custom-type',
        'custom-channel-id',
        undefined
      );
      expect(mockChannel.watch).toHaveBeenCalled();
    });

    it('falls back to local channel definition if backend fails', async () => {
      streamChatService.getChatClient();
      mockClient.userID = 'user-123';
      (chatBackendService.createOrFetchChatSession as jest.Mock).mockRejectedValue(new Error('Backend Fail'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await streamChatService.getAppointmentChannel(appointmentId, vetId, data);

      expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('lookup failed'),
          expect.any(Error)
      );

      expect(mockClient.channel).toHaveBeenCalledWith(
        'messaging',
        `appointment-${appointmentId}`,
        expect.objectContaining({
          name: 'Dr. Smith',
          members: ['user-123', vetId],
        })
      );
    });

    it('uses default channel name if doctorName is missing', async () => {
      streamChatService.getChatClient();
      mockClient.userID = 'user-123';
      (chatBackendService.createOrFetchChatSession as jest.Mock).mockRejectedValue(new Error('Fail'));

      // FIX 3: Removed useless assignment to variable "consoleSpy"
      jest.spyOn(console, 'warn').mockImplementation();

      await streamChatService.getAppointmentChannel(appointmentId, vetId, {});

      expect(mockClient.channel).toHaveBeenCalledWith(
        'messaging',
        expect.any(String),
        expect.objectContaining({ name: 'Appointment Chat' })
      );
    });

    it('handles member logging safe guarding', async () => {
        streamChatService.getChatClient();
        mockClient.userID = 'user-123';
        mockChannel.state.members = {
            'a': { user_id: 'uid1' },
            'b': { id: 'uid2' },
            'c': { user: { id: 'uid3' } },
            'd': null
        };
        (chatBackendService.createOrFetchChatSession as jest.Mock).mockResolvedValue({});

        await streamChatService.getAppointmentChannel(appointmentId, vetId);
        expect(mockChannel.watch).toHaveBeenCalled();
    });
  });

  describe('Messaging & State Utilities', () => {
    it('marks channel as read successfully', async () => {
      streamChatService.getChatClient();
      await streamChatService.markChannelAsRead('chan-1');
      expect(mockClient.channel).toHaveBeenCalledWith('messaging', 'chan-1');
      expect(mockChannel.markRead).toHaveBeenCalled();
    });

    it('handles error when marking read', async () => {
      streamChatService.getChatClient();
      mockChannel.markRead.mockRejectedValue(new Error('Read Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await streamChatService.markChannelAsRead('chan-1');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to mark channel'), expect.any(Error));
    });

    it('gets unread count when connected', async () => {
      streamChatService.getChatClient();
      mockClient.userID = 'user-1';
      mockClient.user = { total_unread_count: 10 };
      const count = await streamChatService.getUnreadCount();
      expect(count).toBe(10);
    });

    it('returns 0 unread count when not connected', async () => {
      streamChatService.getChatClient();
      mockClient.userID = null;
      const count = await streamChatService.getUnreadCount();
      expect(count).toBe(0);
    });

    it('returns 0 unread count on error', async () => {
        streamChatService.getChatClient();
        mockClient.userID = 'u1';

        Object.defineProperty(mockClient, 'user', {
            get: () => { throw new Error('Access error'); }
        });

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const count = await streamChatService.getUnreadCount();

        expect(count).toBe(0);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to get unread'), expect.any(Error));
    });

    it('sends a message successfully', async () => {
      streamChatService.getChatClient();
      await streamChatService.sendMessage('chan-1', 'Hello');
      expect(mockClient.channel).toHaveBeenCalledWith('messaging', 'chan-1');
      expect(mockChannel.sendMessage).toHaveBeenCalledWith({ text: 'Hello' });
    });

    it('throws error when sending message fails', async () => {
      streamChatService.getChatClient();
      mockChannel.sendMessage.mockRejectedValue(new Error('Send Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(streamChatService.sendMessage('chan-1', 'Hi'))
        .rejects.toThrow('Send Fail');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('checks client connection status', () => {
      streamChatService.getChatClient();

      mockClient.userID = 'user-1';
      expect(streamChatService.isClientConnected()).toBe(true);

      mockClient.userID = null;
      expect(streamChatService.isClientConnected()).toBe(false);
    });

    it('gets current user ID', () => {
      streamChatService.getChatClient();

      mockClient.userID = 'user-1';
      expect(streamChatService.getCurrentUserId()).toBe('user-1');

      mockClient.userID = undefined;
      expect(streamChatService.getCurrentUserId()).toBeUndefined();
    });
  });
});