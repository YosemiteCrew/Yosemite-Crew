/**
 * Stream Chat Service
 *
 * Handles Stream Chat client initialization, user connection,
 * and channel management for the mobile app.
 */

import {StreamChat, OwnUserResponse} from 'stream-chat';
import {STREAM_CHAT_CONFIG} from '@/config/variables';
import {
  createOrFetchChatSession,
  fetchChatToken,
} from './chatBackendService';

let chatClient: StreamChat | null = null;

/**
 * Get Stream API key from configuration
 */
const getStreamApiKey = (): string => {
  const apiKey = STREAM_CHAT_CONFIG.apiKey;

  if (!apiKey) {
    console.warn(
      '[Stream] API Key not found. Please add STREAM_CHAT_CONFIG to variables.local.ts',
    );
    throw new Error('Stream API Key not configured');
  }

  return apiKey;
};

/**
 * Get or create Stream Chat client instance (singleton pattern)
 *
 * @returns StreamChat client instance
 * @throws Error if API key is not configured
 */
export const getChatClient = (): StreamChat => {
  if (!chatClient) {
    const apiKey = getStreamApiKey();

    console.log('[Stream] Initializing chat client with API key:', apiKey.substring(0, 8) + '...');
    chatClient = StreamChat.getInstance(apiKey);
  }

  return chatClient;
};

/**
 * Connect user to Stream Chat
 *
 * @param userId - Unique user ID
 * @param userName - Display name for the user
 * @param userImage - Optional avatar URL
 * @param token - Optional authentication token (from backend)
 * @returns Promise<StreamChat> - Connected client instance
 */
export const connectStreamUser = async (
  userId: string,
  userName: string,
  userImage?: string,
  token?: string,
): Promise<StreamChat> => {
  const client = getChatClient();

  // Check if already connected to avoid duplicate connections
  if (client.userID === userId) {
    console.log('[Stream] User already connected:', userId);
    return client;
  }

  // Disconnect existing user if any
  if (client.userID) {
    console.log('[Stream] Disconnecting existing user:', client.userID);
    await client.disconnectUser();
  }

  try {
    console.log('[Stream] Connecting user:', userId);

    // User data to send to Stream
    const userData = {
      id: userId,
      name: userName,
      ...(userImage && {image: userImage}),
    };

    let userToken = token;
  if (!userToken) {
    try {
      userToken = await fetchChatToken();
    } catch (backendError) {
      console.warn(
        '[Stream] Failed to fetch chat token from backend. Falling back to development token.',
        backendError,
      );
        userToken = client.devToken(userId);
      }
    }

    await client.connectUser(userData, userToken);

    console.log('[Stream] User connected successfully:', userId);
    return client;
  } catch (error) {
    console.error('[Stream] Failed to connect user:', error);
    throw new Error('Failed to connect to chat. Please try again.');
  }
};

/**
 * Disconnect user from Stream Chat
 *
 * Call this when user logs out or app closes
 */
export const disconnectStreamUser = async (): Promise<void> => {
  if (chatClient?.userID) {
    try {
      console.log('[Stream] Disconnecting user:', chatClient.userID);
      await chatClient.disconnectUser();
      console.log('[Stream] User disconnected successfully');
    } catch (error) {
      console.error('[Stream] Failed to disconnect user:', error);
    }
  }
};

/**
 * Get or create a channel for an appointment
 *
 * @param appointmentId - Unique appointment ID
 * @param vetId - Veterinarian user ID
 * @param appointmentData - Additional appointment data (doctorName, dateTime, etc.)
 * @returns Promise<Channel> - The appointment channel
 * @throws Error if user is not connected
 */
export const getAppointmentChannel = async (
  appointmentId: string,
  vetId: string,
  appointmentData?: {
    doctorName?: string;
    dateTime?: string;
    petName?: string;
  },
) => {
  const client = getChatClient();

  if (!client.userID) {
    throw new Error('User must be connected before accessing channels');
  }

  let channelId = `appointment-${appointmentId}`;
  let channelType: string = 'messaging';

  console.log('[Stream] Getting/creating channel:', channelId);

  const channelData: Record<string, unknown> = {
    name: appointmentData?.doctorName || 'Appointment Chat',
    members: [client.userID, vetId],
    appointmentId,
    appointmentTime: appointmentData?.dateTime,
    petName: appointmentData?.petName,
    activationMinutes: 5,
    status: 'active',
  };

  try {
    console.log('[Stream][Session] Requesting chat session from backend', {
      sessionId: appointmentId,
      userId: client.userID,
      vetId,
      appointmentTime: appointmentData?.dateTime,
    });

    const session = await createOrFetchChatSession({
      sessionId: appointmentId,
      userId: client.userID,
      vetId,
      appointmentTime: appointmentData?.dateTime,
      petOwnerId: client.userID,
      activationMinutes: 5,
      petName: appointmentData?.petName,
    });

    if (session?.channelId) {
      channelId = session.channelId;
    }
    if (session?.channelType) {
      channelType = session.channelType;
    }

    console.log('[Stream][Session] Backend session resolved', {
      sessionId: appointmentId,
      channelId,
      channelType,
      members: session?.members,
      status: session?.status,
      allowedFrom: session?.allowedFrom,
      allowedUntil: session?.allowedUntil,
    });
  } catch (error) {
    console.warn(
      '[Stream] Chat session lookup failed; using local channel fallback.',
      error,
    );
  }

  const channel = client.channel(
    channelType,
    channelId,
    channelType === 'messaging' && channelId === `appointment-${appointmentId}`
      ? channelData
      : undefined,
  );

  console.log('[Stream][Session] Watching channel', {channelType, channelId});
  await channel.watch();
  const memberIds =
    channel.state?.members && typeof channel.state.members === 'object'
      ? Object.values(channel.state.members)
          .map(m => m?.user?.id ?? (m as any)?.user_id ?? (m as any)?.id ?? null)
          .filter(Boolean)
      : undefined;

  console.log('[Stream][Session] Channel watch established', {
    channelType,
    channelId,
    members: memberIds,
  });

  console.log('[Stream] Channel ready:', channelId);

  return channel;
};

/**
 * Mark all messages in a channel as read
 *
 * @param channelId - Channel ID to mark as read
 */
export const markChannelAsRead = async (channelId: string): Promise<void> => {
  try {
    const client = getChatClient();
    const channel = client.channel('messaging', channelId);
    await channel.markRead();
    console.log('[Stream] Channel marked as read:', channelId);
  } catch (error) {
    console.error('[Stream] Failed to mark channel as read:', error);
  }
};

/**
 * Get unread message count for all channels
 *
 * @returns Promise<number> - Total unread count
 */
export const getUnreadCount = async (): Promise<number> => {
  try {
    const client = getChatClient();
    if (!client.userID) return 0;

    const unreadCount =
      ((client.user as OwnUserResponse | undefined)?.total_unread_count) || 0;
    return unreadCount;
  } catch (error) {
    console.error('[Stream] Failed to get unread count:', error);
    return 0;
  }
};

/**
 * Send a message to a channel
 *
 * @param channelId - Channel ID
 * @param text - Message text
 * @returns Promise<void>
 */
export const sendMessage = async (
  channelId: string,
  text: string,
): Promise<void> => {
  try {
    const client = getChatClient();
    const channel = client.channel('messaging', channelId);

    await channel.sendMessage({
      text,
    });

    console.log('[Stream] Message sent to channel:', channelId);
  } catch (error) {
    console.error('[Stream] Failed to send message:', error);
    throw error;
  }
};

/**
 * Check if client is connected
 *
 * @returns boolean - True if client is connected
 */
export const isClientConnected = (): boolean => {
  return !!chatClient?.userID;
};

/**
 * Get current connected user ID
 *
 * @returns string | undefined - Current user ID or undefined if not connected
 */
export const getCurrentUserId = (): string | undefined => {
  return chatClient?.userID;
};
