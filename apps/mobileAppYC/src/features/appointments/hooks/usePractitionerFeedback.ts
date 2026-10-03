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
    async (appointmentIds: Array<string | null | undefined>, force = false) => {
      const targets = [
        ...new Set(
          appointmentIds.filter(
            (appointmentId): appointmentId is string =>
              typeof appointmentId === 'string' && appointmentId.length > 0,
          ),
        ),
      ].filter(
        appointmentId =>
          !feedbackByAppointment[appointmentId]?.loading &&
          (force ||
            typeof feedbackByAppointment[appointmentId]?.isRated !== 'boolean'),
      );
      if (!targets.length) return;

      const setTargetState = (state: PractitionerFeedbackState) =>
        Object.fromEntries(
          targets.map(appointmentId => [appointmentId, state]),
        );
      setFeedbackByAppointment(previous => ({
        ...previous,
        ...setTargetState({isRated: false, loading: true}),
      }));

      try {
        const tokens = await getFreshStoredTokens();
        const accessToken = tokens?.accessToken;
        if (!accessToken || isTokenExpired(tokens?.expiresAt ?? undefined)) {
          setFeedbackByAppointment(previous => ({
            ...previous,
            ...setTargetState({
              isRated: false,
              loading: false,
              loadError: true,
            }),
          }));
          return;
        }

        const fetchedFeedback =
          await appointmentApi.getPractitionerFeedbackForParent({
            accessToken,
          });
        const loadedFeedback = Object.fromEntries(
          Object.entries(fetchedFeedback).map(([appointmentId, feedback]) => [
            appointmentId,
            {...feedback, loading: false, loadError: false},
          ]),
        );
        const missingFeedback: Record<string, PractitionerFeedbackState> = {};
        for (const appointmentId of targets) {
          if (!fetchedFeedback[appointmentId]) {
            missingFeedback[appointmentId] = {
              isRated: false,
              loading: false,
              loadError: true,
            };
          }
        }
        setFeedbackByAppointment(previous => ({
          ...previous,
          ...missingFeedback,
          ...loadedFeedback,
        }));
      } catch (error) {
        console.warn(
          '[Appointments] Failed to fetch veterinarian feedback',
          describeRequestError(error),
        );
        setFeedbackByAppointment(previous => ({
          ...previous,
          ...setTargetState({isRated: false, loading: false, loadError: true}),
        }));
      }
    },
    [feedbackByAppointment, setFeedbackByAppointment],
  );
