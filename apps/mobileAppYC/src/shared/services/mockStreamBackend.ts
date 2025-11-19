/**
 * Mock Stream Chat Backend Service
 *
 * In production, these functions should call your actual backend API
 * which will securely generate Stream tokens and manage channels.
 *
 * IMPORTANT: Never expose Stream API Secret in frontend code!
 * This mock service is for development purposes only.
 */

import {StreamChat} from 'stream-chat';

// MOCK data for development only
const MOCK_USERS = {
  petOwner1: {
    id: 'pet-owner-1',
    name: 'John Doe',
    image: 'https://i.pravatar.cc/150?img=1',
    role: 'pet-owner',
  },
  vet1: {
    id: 'vet-1',
    name: 'Dr. David Brown',
    image: 'https://i.pravatar.cc/150?img=3',
    role: 'vet',
  },
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
  console.log('[MOCK] Generating token for user:', userId);

  // In development, Stream allows development tokens
  // In production, your backend generates this using Stream Secret
  return 'DEVELOPMENT_TOKEN_' + userId;
};

/**
 * Mock function to get or create a chat channel for an appointment
 * In production: POST /api/chat/channels with appointmentId, petOwnerId, vetId
 *
 * @param client - Stream Chat client instance
 * @param appointmentId - Unique appointment ID
 * @param petOwnerId - Pet owner user ID
 * @param vetId - Veterinarian user ID
 * @param appointmentTime - ISO8601 timestamp of appointment
 * @returns Promise<Channel> - The created/fetched channel
 */
export const mockGetOrCreateAppointmentChannel = async (
  client: StreamChat,
  appointmentId: string,
  petOwnerId: string,
  vetId: string,
  appointmentTime: string,
) => {
  console.log('[MOCK] Creating/fetching channel for appointment:', appointmentId);

  const channelId = `appointment-${appointmentId}`;

  // Create or get existing channel
  const channelData: Record<string, unknown> = {
    name: `Appointment Chat`,
    members: [petOwnerId, vetId],
    // Custom metadata
    appointmentId,
    appointmentTime,
    activationMinutes: 5, // Chat unlocks 5 min before appointment
    status: 'active',
  };

  const channel = client.channel('messaging', channelId, channelData);

  // Watch the channel to receive real-time updates
  await channel.watch();

  return channel;
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
 * Get mock user data by user ID
 *
 * @param userId - User ID to fetch
 * @returns User object with id, name, image
 */
export const getMockUser = (userId: string) => {
  if (userId === 'pet-owner-1') return MOCK_USERS.petOwner1;
  if (userId === 'vet-1') return MOCK_USERS.vet1;

  // Fallback for unknown users
  return {
    id: userId,
    name: 'User ' + userId,
    image: 'https://i.pravatar.cc/150',
    role: 'unknown',
  };
};

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
