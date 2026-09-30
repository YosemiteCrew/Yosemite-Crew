import React from 'react';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '@/features/auth/sessionManager';
import {appointmentApi} from '@/features/appointments/services/appointmentsService';
import {describeRequestError} from '@/shared/utils/safeErrorLog';

export type PractitionerFeedbackState = {
  isRated: boolean;
  rating?: number | null;
  review?: string | null;
  practitionerName?: string | null;
  loading?: boolean;
  loadError?: boolean;
};

export const useFetchPractitionerFeedbackIfNeeded = ({
  feedbackByAppointment,
  setFeedbackByAppointment,
}: {
  feedbackByAppointment: Record<string, PractitionerFeedbackState>;
  setFeedbackByAppointment: React.Dispatch<
    React.SetStateAction<Record<string, PractitionerFeedbackState>>
  >;
}) =>
  React.useCallback(
    async (appointmentId?: string | null, force = false) => {
      if (
        !appointmentId ||
        feedbackByAppointment[appointmentId]?.loading ||
        (!force &&
          typeof feedbackByAppointment[appointmentId]?.isRated === 'boolean')
      ) {
        return;
      }

      setFeedbackByAppointment(previous => ({
        ...previous,
        [appointmentId]: {isRated: false, loading: true},
      }));

      try {
        const tokens = await getFreshStoredTokens();
        const accessToken = tokens?.accessToken;
        if (!accessToken || isTokenExpired(tokens?.expiresAt ?? undefined)) {
          setFeedbackByAppointment(previous => ({
            ...previous,
            [appointmentId]: {isRated: false, loading: false, loadError: true},
          }));
          return;
        }

        const feedback = await appointmentApi.getPractitionerFeedback({
          appointmentId,
          accessToken,
        });
        setFeedbackByAppointment(previous => ({
          ...previous,
          [appointmentId]: {...feedback, loading: false, loadError: false},
        }));
      } catch (error) {
        console.warn(
          '[Appointments] Failed to fetch veterinarian feedback',
          describeRequestError(error),
        );
        setFeedbackByAppointment(previous => ({
          ...previous,
          [appointmentId]: {isRated: false, loading: false, loadError: true},
        }));
      }
    },
    [feedbackByAppointment, setFeedbackByAppointment],
  );
