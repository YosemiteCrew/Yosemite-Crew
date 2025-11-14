/**
 * Mock Stream Chat Backend Service for Web App (PMS)
 *
 * In production, these functions should call your actual backend API
 * which will securely generate Stream tokens and manage channels.
 *
 * IMPORTANT: Never expose Stream API Secret in frontend code!
 * This mock service is for development purposes only.
 */

import {StreamChat} from 'stream-chat';

// Mock vet user (PMS user)
const MOCK_VET_USER = {
  id: 'emp_brown',
  name: 'Dr. David Brown',
  role: 'vet',
  image: 'https://i.pravatar.cc/150?img=3',
};

// Mock pet owner user
const MOCK_PET_OWNER = {
  id: 'pet-owner-1',
  name: 'John Doe',
  role: 'pet-owner',
  image: 'https://i.pravatar.cc/150?img=1',
};

/**
 * Mock function to generate Stream user token
 * In production: POST /api/chat/token with userId
 *
 * @param userId - The user ID to generate token for
 * @returns Promise<string> - The authentication token
 */
export const mockGenerateStreamToken = async (
  userId: string,
): Promise<string> => {
  console.log('[MOCK] Generating token for vet user:', userId);

  // In development, Stream allows development tokens
  // In production, your backend generates this using Stream Secret
  return 'DEVELOPMENT_TOKEN_' + userId;
};

/**
 * Get all active appointment channels for the vet
 *
 * @param client - Stream Chat client instance
 * @param vetId - Veterinarian user ID
 * @returns Promise<Channel[]> - Array of channels
 */
export const mockGetVetChannels = async (client: StreamChat, vetId: string) => {
  console.log('[MOCK] Fetching channels for vet:', vetId);

  const filter = {
    type: 'messaging',
    members: {$in: [vetId]},
  };

  const sort = [{last_message_at: -1 as const}];

  const channels = await client.queryChannels(filter, sort, {
    watch: true,
    state: true,
  });

  console.log('[MOCK] Found channels:', channels.length);

  return channels;
};

/**
 * Mock function to end/close a chat channel
 * In production: POST /api/chat/channels/:channelId/end
 *
 * @param channelId - Channel ID to end
 * @returns Promise<{success: boolean}>
 */
export const mockEndChatChannel = async (
  channelId: string,
): Promise<{success: boolean}> => {
  console.log('[MOCK] Ending chat channel:', channelId);

  // In production, your backend would:
  // 1. Update channel status in database
  // 2. Send system message to channel
  // 3. Optionally disable sending messages
  // 4. Update channel metadata

  return {success: true};
};

/**
 * Check if chat should be active based on appointment time
 *
 * Chat is active from (appointment - activationMinutes) until (appointment + 30 minutes)
 *
 * @param appointmentTime - ISO8601 timestamp of appointment
 * @param activationMinutes - Minutes before appointment when chat unlocks (default: 5)
 * @returns boolean - Whether chat is currently active
 */
export const isChatActive = (
  appointmentTime: string,
  activationMinutes: number = 5,
): boolean => {
  const now = new Date();
  const appointment = new Date(appointmentTime);

  // Calculate when chat should unlock
  const activationTime = new Date(
    appointment.getTime() - activationMinutes * 60000,
  );

  // Chat remains active for 30 minutes after appointment
  const endTime = new Date(appointment.getTime() + 30 * 60000);

  const isActive = now >= activationTime && now <= endTime;

  console.log('[MOCK] Chat active check:', {
    now: now.toISOString(),
    activationTime: activationTime.toISOString(),
    endTime: endTime.toISOString(),
    isActive,
  });

  return isActive;
};

/**
 * Get mock vet user data
 *
 * @returns User object with id, name, role, image
 */
export const getMockVetUser = () => MOCK_VET_USER;

/**
 * Get mock pet owner user data
 *
 * @returns User object with id, name, role, image
 */
export const getMockPetOwner = () => MOCK_PET_OWNER;

/**
 * Format appointment time for display
 *
 * @param appointmentTime - ISO8601 timestamp
 * @returns Formatted string like "Today at 2:00 PM" or "Jan 15 at 2:00 PM"
 */
export const formatAppointmentTime = (appointmentTime: string): string => {
  const date = new Date(appointmentTime);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return `Today at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return `${dateStr} at ${timeStr}`;
};

/**
 * Get time remaining until chat activation
 *
 * @param appointmentTime - ISO8601 timestamp
 * @param activationMinutes - Minutes before appointment when chat unlocks
 * @returns Object with minutes and seconds remaining, or null if already active
 */
export const getTimeUntilChatActivation = (
  appointmentTime: string,
  activationMinutes: number = 5,
): {minutes: number; seconds: number} | null => {
  const now = new Date();
  const appointment = new Date(appointmentTime);
  const activationTime = new Date(
    appointment.getTime() - activationMinutes * 60000,
  );

  if (now >= activationTime) {
    return null; // Already active
  }

  const diffMs = activationTime.getTime() - now.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  return {minutes, seconds};
};
