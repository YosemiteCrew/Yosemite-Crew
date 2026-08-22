import {
  handleChatActivation,
  CHAT_ACTIVATION_MINUTES,
  ChatActivationConfig,
} from '../../../../src/features/appointments/utils/chatActivation';
import {Alert} from 'react-native';
import * as ChatTiming from '../../../../src/shared/services/chatTiming';
import * as TimezoneUtils from '../../../../src/shared/utils/timezoneUtils';

// --- Mocks ---

jest.spyOn(Alert, 'alert');

jest.mock('i18next', () => ({
  t: (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key,
}));

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
    appointment: {date: '2025-01-01', time: '10:00'},
    doctorName: 'Dr. Smith',
    companions: [],
    onOpenChat: mockOnOpenChat,
  };

  const mockIsoTime = '2025-01-01T10:00:00Z';

  beforeEach(() => {
    jest.clearAllMocks();
    (TimezoneUtils.getAppointmentTimeAsIso as jest.Mock).mockReturnValue(
      mockIsoTime,
    );
    (ChatTiming.formatAppointmentTime as jest.Mock).mockReturnValue('10:00 AM');
  });

  describe('Activation window', () => {
    it('uses the same window the backend enforces, not a shorter client-side one', () => {
      // apps/backend/src/services/chat.service.ts PRE_WINDOW_MINUTES = 60 * 24
      expect(CHAT_ACTIVATION_MINUTES).toBe(60 * 24);
    });

    it('opens chat when the window is open', () => {
      (ChatTiming.isChatActive as jest.Mock).mockReturnValue(true);

      handleChatActivation(mockConfig);

      expect(TimezoneUtils.getAppointmentTimeAsIso).toHaveBeenCalledWith(
        mockConfig.appointment.date,
        mockConfig.appointment.time,
      );
      expect(ChatTiming.isChatActive).toHaveBeenCalledWith(
        mockIsoTime,
        CHAT_ACTIVATION_MINUTES,
      );
      expect(mockOnOpenChat).toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe('Chat not open yet', () => {
    it('shows a countdown in hours and minutes', () => {
      (ChatTiming.isChatActive as jest.Mock).mockReturnValue(false);
      (ChatTiming.getTimeUntilChatActivation as jest.Mock).mockReturnValue({
        hours: 3,
        minutes: 12,
        seconds: 30,
      });

      handleChatActivation(mockConfig);

      expect(mockOnOpenChat).not.toHaveBeenCalled();
      const [title, body] = (Alert.alert as jest.Mock).mock.calls[0];
      expect(title).toBe('appointments.chatLockedTitle');
      expect(body).toContain('"hours":3');
      expect(body).toContain('"minutes":12');
    });

    // `hours` is optional on the countdown shape, and the copy interpolates it
    // directly. Without the ?? 0 fallback an absent value renders the body as
    // "unlocks in undefined hours", so pin the fallback rather than the field.
    it('renders zero hours when the countdown omits the hours field', () => {
      (ChatTiming.isChatActive as jest.Mock).mockReturnValue(false);
      (ChatTiming.getTimeUntilChatActivation as jest.Mock).mockReturnValue({
        minutes: 4,
        seconds: 10,
      });

      handleChatActivation(mockConfig);

      const [, body] = (Alert.alert as jest.Mock).mock.calls[0];
      expect(body).toContain('"hours":0');
      expect(body).toContain('"minutes":4');
      expect(body).not.toContain('undefined');
    });

    it('offers no bypass button', () => {
      (ChatTiming.isChatActive as jest.Mock).mockReturnValue(false);
      (ChatTiming.getTimeUntilChatActivation as jest.Mock).mockReturnValue({
        hours: 0,
        minutes: 1,
        seconds: 0,
      });

      handleChatActivation(mockConfig);

      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      expect(buttons).toHaveLength(1);
      expect(
        buttons.some((b: {text?: string}) => /mock/i.test(b.text ?? '')),
      ).toBe(false);
      expect(mockOnOpenChat).not.toHaveBeenCalled();
    });

    it('does not blame the clinic for a client-side window', () => {
      (ChatTiming.isChatActive as jest.Mock).mockReturnValue(false);
      (ChatTiming.getTimeUntilChatActivation as jest.Mock).mockReturnValue({
        hours: 1,
        minutes: 0,
        seconds: 0,
      });

      handleChatActivation(mockConfig);

      const body = (Alert.alert as jest.Mock).mock.calls[0][1];
      expect(body).not.toMatch(/clinic/i);
    });
  });

  describe('Chat closed', () => {
    it('reports the appointment has ended when no time remains', () => {
      (ChatTiming.isChatActive as jest.Mock).mockReturnValue(false);
      (ChatTiming.getTimeUntilChatActivation as jest.Mock).mockReturnValue(
        null,
      );

      handleChatActivation(mockConfig);

      expect(mockOnOpenChat).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'appointments.chatUnavailableTitle',
        'appointments.chatUnavailableBody',
        expect.anything(),
      );
    });
  });
});
