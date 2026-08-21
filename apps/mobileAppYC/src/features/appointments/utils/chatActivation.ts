/**
 * Shared utility for handling chat activation logic
 * Eliminates duplication between MyAppointmentsScreen and HomeScreen
 *
 * Note: Appointment date/time from backend are in UTC
 */

import {Alert} from 'react-native';
import i18next from 'i18next';
import {
  isChatActive,
  getTimeUntilChatActivation,
  formatAppointmentTime,
} from '@/shared/services/chatTiming';
import {getAppointmentTimeAsIso} from '@/shared/utils/timezoneUtils';

export interface ChatActivationConfig {
  appointment: any;
  employee?: any;
  companions: any[];
  doctorName: string;
  petName?: string;
  onOpenChat: () => void;
}

/**
 * Minutes before the appointment that chat opens.
 *
 * Must match PRE_WINDOW_MINUTES in apps/backend/src/services/chat.service.ts.
 * The client used to allow 5 minutes while the backend allowed 24 hours, so
 * the app locked users out of a chat the server was happy to serve.
 */
export const CHAT_ACTIVATION_MINUTES = 60 * 24;

/**
 * Handle chat activation logic with proper time validation
 * Shows alerts if chat is locked or unavailable
 *
 * Backend sends appointment.date and appointment.time in UTC
 */
export const handleChatActivation = (config: ChatActivationConfig): void => {
  const {appointment, onOpenChat} = config;

  // Convert UTC date/time to ISO format with Z suffix
  const appointmentDateTime = getAppointmentTimeAsIso(
    appointment.date,
    appointment.time,
  );
  const chatIsActive = isChatActive(
    appointmentDateTime,
    CHAT_ACTIVATION_MINUTES,
  );

  if (!chatIsActive) {
    const timeRemaining = getTimeUntilChatActivation(
      appointmentDateTime,
      CHAT_ACTIVATION_MINUTES,
    );

    if (timeRemaining) {
      Alert.alert(
        i18next.t('appointments.chatLockedTitle'),
        i18next.t('appointments.chatLockedBody', {
          appointmentTime: formatAppointmentTime(appointmentDateTime),
          hours: timeRemaining.hours ?? 0,
          minutes: timeRemaining.minutes,
        }),
        [{text: i18next.t('common.ok')}],
        {cancelable: true},
      );
    } else {
      Alert.alert(
        i18next.t('appointments.chatUnavailableTitle'),
        i18next.t('appointments.chatUnavailableBody'),
        [{text: i18next.t('common.ok')}],
      );
    }
    return;
  }

  onOpenChat();
};
