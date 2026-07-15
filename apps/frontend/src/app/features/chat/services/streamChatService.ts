/**
 * Stream Chat Service for Web App (PMS)
 *
 * Handles Stream Chat client initialization, user connection,
 * and channel management for the PMS web application.
 */

import { StreamChat } from 'stream-chat';
import {
  getChatToken,
  createChatSession,
  closeChatSession as apiCloseChatSession,
} from '@/app/features/chat/services/chatService';

let chatClient: StreamChat | null = null;

// Utility function to log errors with context
const logError = (context: string, error: unknown, additionalInfo?: Record<string, unknown>) => {
  const errorInfo = {
    context,
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    userId: chatClient?.userID,
    ...additionalInfo,
  };

  console.error('Stream Chat Service Error:', errorInfo);

  // In a real application, you might want to send this to an error tracking service
  // errorReportingService.captureException(error, errorInfo);
};

/**
 * Get Stream API key from environment
 */
const getStreamApiKey = (): string => {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Stream API Key not configured. Please check NEXT_PUBLIC_STREAM_API_KEY environment variable.'
    );
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
    try {
      const apiKey = getStreamApiKey();
      chatClient = StreamChat.getInstance(apiKey);
    } catch (error) {
      const context = 'getChatClient - Failed to initialize Stream Chat client';
      logError(context, error, { hasApiKey: !!process.env.NEXT_PUBLIC_STREAM_API_KEY });
      throw new Error('Failed to initialize chat client. Please check your configuration.');
    }
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
  userImage?: string
): Promise<StreamChat> => {
  const client = getChatClient();

  // Validate input parameters
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID provided for connection');
  }
  if (!userName || typeof userName !== 'string') {
    throw new Error('Invalid user name provided for connection');
  }

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
    try {
      await client.disconnectUser();
    } catch (error) {
      const context = 'connectStreamUser - Error disconnecting existing user';
      logError(context, error, {
        existingUserId: client.userID,
        newUserId: userId,
      });
      // Continue with connection even if disconnect fails
    }
  }

  connectionPromise = (async () => {
    try {
      // User data to send to Stream
      const userData: { id: string; name: string; image?: string } = {
        id: userId,
        name: userName,
      };

      if (userImage) {
        userData.image = userImage;
      }

      // Connect with a token provider rather than a static token so Stream
      // refreshes the token automatically before it expires. A static token
      // would drop the socket once it lapses (tokens are short-lived); the
      // provider is re-invoked by Stream on connect and ahead of each expiry.
      await client.connectUser(userData, async () => {
        const { token } = await getChatToken();
        return token;
      });

      return client;
    } catch (error) {
      const context = 'connectStreamUser - Failed to connect user to Stream Chat';
      logError(context, error, {
        userId,
        userName,
        hasImage: !!userImage,
        hasToken: !!client?.user,
      });

      if (error instanceof Error) {
        throw new Error(`Failed to connect to chat: ${error.message}`);
      }
      throw new Error('Failed to connect to chat. Please try again.');
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

/**
 * Get or create a channel for an appointment
 *
 * @param appointmentId - Unique appointment ID
 * @returns Promise<Channel> - The appointment channel
 * @throws Error if user is not connected
 */
export const getAppointmentChannel = async (appointmentId: string) => {
  if (!appointmentId || typeof appointmentId !== 'string') {
    throw new Error('Invalid appointment ID provided');
  }

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
    const context = 'getAppointmentChannel - Failed to access appointment channel';
    logError(context, error, {
      appointmentId,
      userId: client.userID,
    });

    if (error instanceof Error) {
      throw new Error(`Failed to access chat for appointment: ${error.message}`);
    }
    throw new Error('Failed to access chat for this appointment');
  }
};

/**
 * End a chat channel (PMS only)
 *
 * @param sessionId - Session ID to end
 * @returns Promise<void>
 */
export const endChatChannel = async (sessionId: string): Promise<void> => {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Invalid session ID provided');
  }

  try {
    // Call backend API to close the session
    await apiCloseChatSession(sessionId);
  } catch (error) {
    const context = 'endChatChannel - Failed to end chat channel';
    logError(context, error, {
      sessionId,
      userId: chatClient?.userID,
    });

    if (error instanceof Error) {
      throw new Error(`Failed to end chat session: ${error.message}`);
    }
    throw new Error('Failed to end chat session due to an unknown error');
  }
};
