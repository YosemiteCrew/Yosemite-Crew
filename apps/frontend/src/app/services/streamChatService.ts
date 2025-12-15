/**
 * Stream Chat Service for Web App (PMS)
 *
 * Handles Stream Chat client initialization, user connection,
 * and channel management for the PMS web application.
 */

import {StreamChat, OwnUserResponse} from 'stream-chat';
import { getChatToken, createChatSession, closeChatSession as apiCloseChatSession } from './chatService';

let chatClient: StreamChat | null = null;

/**
 * Get Stream API key from environment
 */
const getStreamApiKey = (): string => {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

  if (!apiKey) {
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
 * @returns Promise<StreamChat> - Connected client instance
 */
let connectionPromise: Promise<StreamChat> | null = null;

export const connectStreamUser = async (
  userId: string,
  userName: string,
  userImage?: string,
): Promise<StreamChat> => {
  const client = getChatClient();

  // Check if already connected to avoid duplicate connections
  if (client.userID === userId) {
    return client;
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // Disconnect existing user if any
  if (client.userID) {
    await client.disconnectUser();
  }

  connectionPromise = (async () => {
    try {
      // User data to send to Stream
      const userData: {id: string; name: string; image?: string} = {
        id: userId,
        name: userName,
      };

      if (userImage) {
        userData.image = userImage;
      }

      // Get token from backend API
      const { token } = await getChatToken();

      await client.connectUser(userData, token);

      return client;
    } catch (error) {
      throw new Error('Failed to connect to chat. Please try again.');
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

/**
 * Disconnect user from Stream Chat
 *
 * Call this when user logs out
 */
export const disconnectStreamUser = async (): Promise<void> => {
  if (chatClient?.userID) {
    try {
      await chatClient.disconnectUser();
    } catch (error) {
      // Silent fail on disconnect
    }
  }
};

/**
 * Get or create a channel for an appointment
 *
 * @param appointmentId - Unique appointment ID
 * @returns Promise<Channel> - The appointment channel
 * @throws Error if user is not connected
 */
export const getAppointmentChannel = async (
  appointmentId: string,
) => {
  const client = getChatClient();

  if (!client.userID) {
    throw new Error('User must be connected before accessing channels');
  }

  try {
    // Create or get existing channel via backend API
    const { channelId } = await createChatSession(appointmentId);

    // Get channel reference from Stream
    const channel = client.channel('messaging', channelId);

    // Watch the channel to receive real-time updates
    await channel.watch();

    return channel;
  } catch (error) {
    throw new Error('Failed to access chat for this appointment');
  }
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
  } catch (error) {
    // Silent fail
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
  } catch (error) {
    throw error;
  }
};

/**
 * End a chat channel (PMS only)
 *
 * @param sessionId - Session ID to end
 * @returns Promise<void>
 */
export const endChatChannel = async (sessionId: string): Promise<void> => {
  try {
    // Call backend API to close the session
    await apiCloseChatSession(sessionId);
  } catch (error) {
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
