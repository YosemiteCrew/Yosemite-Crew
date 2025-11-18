/**
 * Stream Chat Service for Web App (PMS)
 *
 * Handles Stream Chat client initialization, user connection,
 * and channel management for the PMS web application.
 */

import {StreamChat, OwnUserResponse} from 'stream-chat';

let chatClient: StreamChat | null = null;

/**
 * Get Stream API key from environment
 */
const getStreamApiKey = (): string => {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

  if (!apiKey) {
    console.error('[Stream] API Key not found. Please set NEXT_PUBLIC_STREAM_API_KEY in .env.local');
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

    console.log('[Stream] Initializing chat client');
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
    const userData: {id: string; name: string; image?: string} = {
      id: userId,
      name: userName,
    };

    if (userImage) {
      userData.image = userImage;
    }

    // Use provided token or generate development token
    // IMPORTANT: In production, always use backend-generated tokens!
    const userToken = token || client.devToken(userId);

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
 * Call this when user logs out
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
 * @param petOwnerId - Pet owner user ID
 * @param appointmentData - Additional appointment data
 * @returns Promise<Channel> - The appointment channel
 * @throws Error if user is not connected
 */
export const getAppointmentChannel = async (
  appointmentId: string,
  petOwnerId: string,
  appointmentData?: {
    petOwnerName?: string;
    appointmentTime?: string;
    petName?: string;
  },
) => {
  const client = getChatClient();

  if (!client.userID) {
    throw new Error('User must be connected before accessing channels');
  }

  const channelId = `appointment-${appointmentId}`;

  console.log('[Stream] Getting/creating channel:', channelId);

  // Create or get existing channel
  const channelData: Record<string, unknown> = {
    name: `Chat with ${appointmentData?.petOwnerName || 'Pet Owner'}`,
    members: [client.userID, petOwnerId],
    // Custom metadata
    appointmentId,
    appointmentTime: appointmentData?.appointmentTime,
    petName: appointmentData?.petName,
    activationMinutes: 5,
    status: 'active',
  };

  const channel = client.channel('messaging', channelId, channelData);

  // Watch the channel to receive real-time updates
  await channel.watch();

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
 * End a chat channel (PMS only)
 *
 * @param channelId - Channel ID to end
 * @returns Promise<void>
 */
export const endChatChannel = async (channelId: string): Promise<void> => {
  try {
    const client = getChatClient();
    const channel = client.channel('messaging', channelId);

    // Send system message
    await channel.sendMessage({
      text: 'This chat has been ended by the veterinary practice. Thank you!',
      user_id: 'system',
    });

    // Update channel metadata
    await channel.updatePartial({
      set: {
        status: 'ended',
      },
    } as any);

    console.log('[Stream] Channel ended:', channelId);
  } catch (error) {
    console.error('[Stream] Failed to end channel:', error);
    throw error;
  }
};

/**
 * Check if client is connected
 *
 * @returns boolean - True if client is connected
 */
export const isClientConnected = (): boolean => {
  return chatClient?.userID !== undefined;
};

/**
 * Get current connected user ID
 *
 * @returns string | undefined - Current user ID or undefined if not connected
 */
export const getCurrentUserId = (): string | undefined => {
  return chatClient?.userID;
};
