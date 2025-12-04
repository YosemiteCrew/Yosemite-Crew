import { StreamChat } from 'stream-chat';
import {
  mockGenerateStreamToken,
  mockGetOrCreateAppointmentChannel,
  isChatActive,
  getMockUser,
  formatAppointmentTime,
  getTimeUntilChatActivation,
} from '../../src/shared/services/mockStreamBackend';

// Mock StreamChat client
const mockChannel = {
  watch: jest.fn().mockResolvedValue(undefined),
};

const mockClient = {
  channel: jest.fn().mockReturnValue(mockChannel),
} as unknown as StreamChat;

describe('mockStreamBackend Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('mockGenerateStreamToken', () => {
    it('generates a development token for a given user ID', async () => {
      const userId = 'test-user-123';
      const token = await mockGenerateStreamToken(userId);
      expect(token).toBe(`DEVELOPMENT_TOKEN_${userId}`);
    });
  });

  describe('mockGetOrCreateAppointmentChannel', () => {
    it('creates and watches a channel with correct parameters', async () => {
      const appointmentId = 'apt-001';
      const petOwnerId = 'owner-1';
      const vetId = 'vet-1';
      const appointmentTime = new Date().toISOString();

      const channel = await mockGetOrCreateAppointmentChannel(
        mockClient,
        appointmentId,
        petOwnerId,
        vetId,
        appointmentTime,
      );

      expect(mockClient.channel).toHaveBeenCalledWith(
        'messaging',
        `appointment-${appointmentId}`,
        expect.objectContaining({
          name: 'Appointment Chat',
          members: [petOwnerId, vetId],
          appointmentId,
          appointmentTime,
          activationMinutes: 5,
          status: 'active',
        }),
      );

      expect(mockChannel.watch).toHaveBeenCalled();
      expect(channel).toBe(mockChannel);
    });
  });

  describe('isChatActive', () => {
    const mockNow = new Date('2023-10-10T12:00:00Z'); // Baseline "Now"

    beforeEach(() => {
      jest.setSystemTime(mockNow);
    });

    it('returns true if within the activation window (5 mins before start)', () => {
      // Appointment is at 12:04 (4 mins from now). Window starts at 11:59.
      // Currently 12:00. Should be active.
      const appointmentTime = new Date('2023-10-10T12:04:00Z').toISOString();
      expect(isChatActive(appointmentTime, 5)).toBe(true);
    });

    it('returns true if within the active window (during appointment)', () => {
      // Appointment started 10 mins ago.
      const appointmentTime = new Date('2023-10-10T11:50:00Z').toISOString();
      expect(isChatActive(appointmentTime, 5)).toBe(true);
    });

    it('returns false if before the activation window', () => {
      // Appointment is in 1 hour.
      const appointmentTime = new Date('2023-10-10T13:00:00Z').toISOString();
      expect(isChatActive(appointmentTime, 5)).toBe(false);
    });

    it('returns false if after the expiration window (30 mins after start)', () => {
      // Appointment was 1 hour ago. Window ended 30 mins ago.
      const appointmentTime = new Date('2023-10-10T11:00:00Z').toISOString();
      expect(isChatActive(appointmentTime, 5)).toBe(false);
    });
  });

  describe('getMockUser', () => {
    it('returns predefined user data for pet owner', () => {
      const user = getMockUser('pet-owner-1');
      expect(user).toEqual(expect.objectContaining({ name: 'John Doe', role: 'pet-owner' }));
    });

    it('returns predefined user data for vet', () => {
      const user = getMockUser('vet-1');
      expect(user).toEqual(expect.objectContaining({ name: 'Dr. David Brown', role: 'vet' }));
    });

    it('returns fallback data for unknown users', () => {
      const userId = 'unknown-123';
      const user = getMockUser(userId);
      expect(user).toEqual({
        id: userId,
        name: `User ${userId}`,
        image: 'https://i.pravatar.cc/150',
        role: 'unknown',
      });
    });
  });

  describe('formatAppointmentTime', () => {
    const mockNow = new Date('2023-10-10T10:00:00Z');

    beforeEach(() => {
      jest.setSystemTime(mockNow);
    });

    it('formats time correctly for "Today"', () => {
      // Same day, 2:00 PM
      const today = new Date('2023-10-10T14:00:00Z').toISOString();
      const result = formatAppointmentTime(today);
      // Note: Output depends on locale, assuming en-US environment for tests
      // Result might vary slightly based on running environment timezone if not forced
      expect(result).toMatch(/Today at/);
    });

    it('formats date and time correctly for future dates', () => {
      // Different day
      const future = new Date('2023-11-15T14:00:00Z').toISOString();
      const result = formatAppointmentTime(future);
      expect(result).not.toMatch(/Today/);
      // Should contain month/day
      expect(result).toMatch(/Nov 15/);
    });
  });

  describe('getTimeUntilChatActivation', () => {
    const mockNow = new Date('2023-10-10T12:00:00Z');

    beforeEach(() => {
      jest.setSystemTime(mockNow);
    });

    it('returns null if chat is already active', () => {
      // Appointment is now (active started 5 mins ago)
      const appointmentTime = new Date('2023-10-10T12:00:00Z').toISOString();
      expect(getTimeUntilChatActivation(appointmentTime)).toBeNull();
    });

    it('returns correct countdown if chat is not yet active', () => {
      // Appointment is in 10 minutes (12:10).
      // Activation is 5 mins before (12:05).
      // Current time 12:00.
      // Remaining time should be 5 minutes.
      const appointmentTime = new Date('2023-10-10T12:10:00Z').toISOString();
      const result = getTimeUntilChatActivation(appointmentTime, 5);

      expect(result).not.toBeNull();
      expect(result?.minutes).toBe(5);
      expect(result?.seconds).toBe(0);
    });

    it('handles seconds correctly', () => {
        // Appointment is in 6 minutes and 30 seconds (12:06:30).
        // Activation starts at 12:01:30 (5 mins prior).
        // Current time 12:00:00.
        // Time until activation: 1 minute 30 seconds.
        const appointmentTime = new Date('2023-10-10T12:06:30Z').toISOString();
        const result = getTimeUntilChatActivation(appointmentTime, 5);

        expect(result?.minutes).toBe(1);
        expect(result?.seconds).toBe(30);
    });
  });
});