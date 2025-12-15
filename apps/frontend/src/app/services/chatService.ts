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
    throw new Error('Failed to get chat token');
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
  try {
    const response = await postData<CreateChatSessionResponse>(
      `/v1/chat/pms/sessions/${appointmentId}`
    );
    return response.data;
  } catch (error) {
    throw new Error('Failed to create chat session');
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
    throw new Error('Failed to get chat sessions');
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
  try {
    const response = await getData<CreateChatSessionResponse>(
      `/v1/chat/pms/sessions/${appointmentId}`
    );
    return response.data;
  } catch (error) {
    throw new Error('Failed to get chat session');
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
  try {
    const response = await postData<CloseChatSessionResponse>(
      `/v1/chat/pms/sessions/${sessionId}/close`
    );
    return response.data;
  } catch (error) {
    throw new Error('Failed to close chat session');
  }
};
