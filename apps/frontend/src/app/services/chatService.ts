/**
 * Chat Service
 *
 * Handles all chat-related API calls to the backend
 */

import { getData, postData } from './axios';
import type {
  ChatTokenResponse,
  CreateChatSessionResponse,
  ChatSessionListResponse,
  CloseChatSessionResponse,
} from '../types/chat';

// Utility function to log errors with context
const logError = (context: string, error: unknown, additionalInfo?: Record<string, unknown>) => {
  const errorInfo = {
    context,
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...additionalInfo,
  };
  
  console.error('Chat Service Error:', errorInfo);
  
  // In a real application, you might want to send this to an error tracking service
  // errorReportingService.captureException(error, errorInfo);
};

/**
 * Get Stream Chat authentication token
 *
 * @returns Promise<ChatTokenResponse>
 */
export const getChatToken = async (): Promise<ChatTokenResponse> => {
  try {
    const response = await postData<ChatTokenResponse>('/v1/chat/pms/token');
    return response.data;
  } catch (error) {
    const context = 'getChatToken - Failed to retrieve chat authentication token';
    logError(context, error, { endpoint: '/v1/chat/pms/token' });
    
    if (error instanceof Error) {
      throw new Error(`Failed to get chat token: ${error.message}`);
    }
    throw new Error('Failed to get chat token due to an unknown error');
  }
};

/**
 * Create or get chat session for an appointment
 *
 * @param appointmentId - The appointment ID
 * @returns Promise<CreateChatSessionResponse>
 */
export const createChatSession = async (
  appointmentId: string
): Promise<CreateChatSessionResponse> => {
  if (!appointmentId || typeof appointmentId !== 'string') {
    throw new Error('Invalid appointment ID provided');
  }

  try {
    const response = await postData<CreateChatSessionResponse>(
      `/v1/chat/pms/sessions/${appointmentId}`
    );
    return response.data;
  } catch (error) {
    const context = 'createChatSession - Failed to create or retrieve chat session';
    logError(context, error, { appointmentId });
    
    if (error instanceof Error) {
      throw new Error(`Failed to create chat session: ${error.message}`);
    }
    throw new Error(`Failed to create chat session for appointment: ${appointmentId}`);
  }
};

/**
 * Get list of all active chat sessions
 *
 * @returns Promise<ChatSessionListResponse>
 */
export const getChatSessions = async (): Promise<ChatSessionListResponse> => {
  try {
    const response = await getData<ChatSessionListResponse>('/v1/chat/pms/sessions/list');
    return response.data;
  } catch (error) {
    const context = 'getChatSessions - Failed to retrieve chat sessions list';
    logError(context, error, { endpoint: '/v1/chat/pms/sessions/list' });
    
    if (error instanceof Error) {
      throw new Error(`Failed to get chat sessions: ${error.message}`);
    }
    throw new Error('Failed to retrieve chat sessions list');
  }
};

/**
 * Get a specific chat session by appointment ID
 *
 * @param appointmentId - The appointment ID
 * @returns Promise<CreateChatSessionResponse>
 */
export const getChatSession = async (
  appointmentId: string
): Promise<CreateChatSessionResponse> => {
  if (!appointmentId || typeof appointmentId !== 'string') {
    throw new Error('Invalid appointment ID provided');
  }

  try {
    const response = await getData<CreateChatSessionResponse>(
      `/v1/chat/pms/sessions/${appointmentId}`
    );
    return response.data;
  } catch (error) {
    const context = 'getChatSession - Failed to retrieve specific chat session';
    logError(context, error, { appointmentId });
    
    if (error instanceof Error) {
      throw new Error(`Failed to get chat session: ${error.message}`);
    }
    throw new Error(`Failed to retrieve chat session for appointment: ${appointmentId}`);
  }
};

/**
 * Close a chat session
 *
 * @param sessionId - The session ID to close
 * @returns Promise<CloseChatSessionResponse>
 */
export const closeChatSession = async (
  sessionId: string
): Promise<CloseChatSessionResponse> => {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Invalid session ID provided');
  }

  try {
    const response = await postData<CloseChatSessionResponse>(
      `/v1/chat/pms/sessions/${sessionId}/close`
    );
    return response.data;
  } catch (error) {
    const context = 'closeChatSession - Failed to close chat session';
    logError(context, error, { sessionId });
    
    if (error instanceof Error) {
      throw new Error(`Failed to close chat session: ${error.message}`);
    }
    throw new Error(`Failed to close chat session: ${sessionId}`);
  }
};
