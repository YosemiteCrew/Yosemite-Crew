import {useCallback} from 'react';
import {Alert, Platform, ToastAndroid} from 'react-native';
import {useDispatch} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {
  checkInAppointment,
  fetchAppointmentById,
  fetchAppointmentsForCompanion,
} from '@/features/appointments/appointmentsSlice';
import LocationService from '@/shared/services/LocationService';
import {distanceBetweenCoordsMeters} from '@/shared/utils/geoDistance';
import {isWithinCheckInWindow, formatCheckInTime, getCheckInConstants} from '@/features/appointments/utils/checkInUtils';

export interface CheckInHandlerConfig {
  appointment: {
    id: string;
    date: string;
    time: string;
    companionId?: string;
  };
  businessCoordinates: {lat: number | null; lng: number | null};
  onCheckingInChange: (id: string, checking: boolean) => void;
  hasPermission: boolean;
  onPermissionDenied?: () => void;
}

/**
 * Hook for handling appointment check-in validation and dispatch
 * Consolidates location validation, time checking, and API calls
 */
export const useCheckInHandler = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {CHECKIN_RADIUS_METERS} = getCheckInConstants();

  const handleCheckIn = useCallback(
    async (config: CheckInHandlerConfig) => {
      const {
        appointment,
        businessCoordinates,
        onCheckingInChange,
        hasPermission,
        onPermissionDenied,
      } = config;

      if (!hasPermission) {
        onPermissionDenied?.();
        return;
      }

      const withinTimeWindow = isWithinCheckInWindow(appointment.date, appointment.time);
      if (!withinTimeWindow) {
        const startLabel = formatCheckInTime(appointment.date, appointment.time);
        Alert.alert(
          'Too early to check in',
          `You can check in starting 5 minutes before your appointment at ${startLabel}.`,
        );
        return;
      }

      const {lat, lng} = businessCoordinates;
      if (!lat || !lng) {
        Alert.alert('Location unavailable', 'Business location is missing. Please try again later.');
        return;
      }

      const userCoords = await LocationService.getLocationWithRetry(2);
      if (!userCoords) {
        return;
      }

      const distance = distanceBetweenCoordsMeters(
        userCoords.latitude,
        userCoords.longitude,
        lat,
        lng,
      );

      if (distance === null) {
        Alert.alert('Location unavailable', 'Unable to determine distance for check-in.');
        return;
      }

      if (distance > CHECKIN_RADIUS_METERS) {
        Alert.alert(
          'Too far to check in',
          `Move closer to the business to check in. You are ~${Math.round(distance)}m away.`,
        );
        return;
      }

      onCheckingInChange(appointment.id, true);
      try {
        await dispatch(checkInAppointment({appointmentId: appointment.id})).unwrap();
        await dispatch(fetchAppointmentById({appointmentId: appointment.id})).unwrap();
        if (appointment.companionId) {
          dispatch(fetchAppointmentsForCompanion({companionId: appointment.companionId}));
        }
        if (Platform.OS === 'android') {
          ToastAndroid.show('Checked in', ToastAndroid.SHORT);
        }
      } catch (error) {
        console.warn('[Appointment] Check-in failed', error);
        Alert.alert('Check-in failed', 'Unable to check in right now. Please try again.');
      } finally {
        onCheckingInChange(appointment.id, false);
      }
    },
    [dispatch, CHECKIN_RADIUS_METERS],
  );

  return {handleCheckIn, CHECKIN_RADIUS_METERS};
};
