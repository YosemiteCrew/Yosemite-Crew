import { handleChatActivation, ChatActivationConfig } from '../../../../src/features/appointments/utils/chatActivation';
import { Alert } from 'react-native';
import * as ChatTiming from '../../../../src/shared/services/chatTiming';
import * as TimezoneUtils from '../../../../src/shared/utils/timezoneUtils';
import { AUTH_FEATURE_FLAGS } from '../../../../src/config/variables';

// --- Mocks ---

// Mock React Native Alert
jest.spyOn(Alert, 'alert');

// Mock Config Variables
jest.mock('../../../../src/config/variables', () => ({
  AUTH_FEATURE_FLAGS: {
    enableReviewLogin: false, // Default to false
  },
}));

// Mock Helper Services
jest.mock('../../../../src/shared/services/chatTiming', () => ({
  isChatActive: jest.fn(),
  getTimeUntilChatActivation: jest.fn(),
  formatAppointmentTime: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/timezoneUtils', () => ({
  getAppointmentTimeAsIso: jest.fn(),
}));

describe('chatActivation', () => {
  const mockOnOpenChat = jest.fn();
  const mockConfig: ChatActivationConfig = {
    appointment: { date: '2025-01-01', time: '10:00' },
    doctorName: 'Dr. Smith',
    companions: [],
    onOpenChat: mockOnOpenChat,
  };

  const mockIsoTime = '2025-01-01T10:00:00Z';

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock setup
    (TimezoneUtils.getAppointmentTimeAsIso as jest.Mock).mockReturnValue(mockIsoTime);
    (ChatTiming.formatAppointmentTime as jest.Mock).mockReturnValue('10:00 AM');
    // Default to normal mode (not review)
    (AUTH_FEATURE_FLAGS as any).enableReviewLogin = false;
  });

  describe('Review Mode Bypass', () => {
    it('bypasses time checks and opens chat if review mode is enabled', () => {
      // Enable review mode
      (AUTH_FEATURE_FLAGS as any).enableReviewLogin = true;

      handleChatActivation(mockConfig);

      expect(mockOnOpenChat).toHaveBeenCalled();
      expect(ChatTiming.isChatActive).not.toHaveBeenCalled();
    });
  });

  describe('Standard Activation Logic', () => {
    it('opens chat if time constraints are met (isChatActive = true)', () => {
      (ChatTiming.isChatActive as jest.Mock).mockReturnValue(true);

      handleChatActivation(mockConfig);

      expect(TimezoneUtils.getAppointmentTimeAsIso).toHaveBeenCalledWith(
        mockConfig.appointment.date,
        mockConfig.appointment.time
      );
      expect(ChatTiming.isChatActive).toHaveBeenCalledWith(mockIsoTime, 5); // Check hardcoded 5 minutes
      expect(mockOnOpenChat).toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe('Chat Locked (Future)', () => {
    it('shows "Chat Locked" alert with countdown if chat is not active and time remains', () => {
      (ChatTiming.isChatActive as jest.Mock).mockReturnValue(false);
      (ChatTiming.getTimeUntilChatActivation as jest.Mock).mockReturnValue({ minutes: 4, seconds: 30 });

      handleChatActivation(mockConfig);

      expect(mockOnOpenChat).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.stringContaining('Chat Locked'),
        expect.stringContaining('Unlocks in: 4m 30s'),
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('triggers mock chat via alert button if user presses "Mock Chat"', () => {
      (ChatTiming.isChatActive as jest.Mock).mockReturnValue(false);
      (ChatTiming.getTimeUntilChatActivation as jest.Mock).mockReturnValue({ minutes: 1, seconds: 0 });

      handleChatActivation(mockConfig);

      // Extract the 'Mock Chat' button config from the Alert call arguments
      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const mockChatButton = alertButtons.find((b: any) => b.text === 'Mock Chat (Testing)');

      expect(mockChatButton).toBeDefined();

      // Simulate press
      mockChatButton.onPress();
      expect(mockOnOpenChat).toHaveBeenCalled();
    });
  });

  describe('Chat Unavailable (Past)', () => {
    it('shows "Chat Unavailable" alert if chat is not active and no time remains (expired)', () => {
      (ChatTiming.isChatActive as jest.Mock).mockReturnValue(false);
      // Null return from getTimeUntilChatActivation usually implies time has passed/invalid in this context
      (ChatTiming.getTimeUntilChatActivation as jest.Mock).mockReturnValue(null);

      handleChatActivation(mockConfig);

      expect(mockOnOpenChat).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Chat Unavailable',
        expect.stringContaining('appointment has ended'),
        expect.anything()
      );
    });
  });
});