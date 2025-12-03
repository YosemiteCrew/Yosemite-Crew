/**
 * Shared utility for handling chat activation logic
 * Eliminates duplication between MyAppointmentsScreen and HomeScreen
 */

import {Alert} from 'react-native';
import {isChatActive, getTimeUntilChatActivation, formatAppointmentTime} from '@/shared/services/mockStreamBackend';

export interface ChatActivationConfig {
  appointment: any;
  employee?: any;
  companions: any[];
  doctorName: string;
  petName?: string;
  onOpenChat: () => void;
}

/**
 * Handle chat activation logic with proper time validation
 * Shows alerts if chat is locked or unavailable
 */
export const handleChatActivation = (config: ChatActivationConfig): void => {
  const {appointment, onOpenChat} = config;

  const appointmentDateTime = `${appointment.date}T${appointment.time}:00`;
  const activationMinutes = 5;
  const chatIsActive = isChatActive(appointmentDateTime, activationMinutes);

  if (!chatIsActive) {
    const timeRemaining = getTimeUntilChatActivation(appointmentDateTime, activationMinutes);

    if (timeRemaining) {
      const formattedTime = formatAppointmentTime(appointmentDateTime);

      Alert.alert(
        'Chat Locked 🔒',
        `Chat will be available ${activationMinutes} minutes before your appointment.\n\n` +
          `Appointment: ${formattedTime}\n` +
          `Unlocks in: ${timeRemaining.minutes}m ${timeRemaining.seconds}s\n\n` +
          `(This restriction comes from your clinic's settings)`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Mock Chat (Testing)',
            style: 'default',
            onPress: () => {
              console.log('[MOCK] Bypassing chat time restriction for testing');
              onOpenChat();
            },
          },
        ],
        {cancelable: true},
      );
    } else {
      Alert.alert(
        'Chat Unavailable',
        'This appointment has ended and chat is no longer available.',
        [{text: 'OK'}],
      );
    }
    return;
  }

  onOpenChat();
};
