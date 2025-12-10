import React from 'react';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {appointmentApi} from '@/features/appointments/services/appointmentsService';

export type OrgRatingState = {
  isRated: boolean;
  rating?: number | null;
  review?: string | null;
  loading?: boolean;
};

type OrgRatingsMap = Record<string, OrgRatingState>;

export const useFetchOrgRatingIfNeeded = ({
  orgRatings,
  setOrgRatings,
  logTag = 'Appointments',
}: {
  orgRatings: OrgRatingsMap;
  setOrgRatings: React.Dispatch<React.SetStateAction<OrgRatingsMap>>;
  logTag?: string;
}) =>
  React.useCallback(
    async (organisationId?: string | null) => {
      if (
        !organisationId ||
        orgRatings[organisationId]?.loading ||
        typeof orgRatings[organisationId]?.isRated === 'boolean'
      ) {
        return;
      }
      try {
        setOrgRatings(prev => ({...prev, [organisationId]: {...prev[organisationId], loading: true}}));
        const tokens = await getFreshStoredTokens();
        const accessToken = tokens?.accessToken;
        if (!accessToken || isTokenExpired(tokens?.expiresAt ?? undefined)) {
          setOrgRatings(prev => ({...prev, [organisationId]: {isRated: false, loading: false}}));
          return;
        }
        const res = await appointmentApi.getOrganisationRatingStatus({
          organisationId,
          accessToken,
        });
        setOrgRatings(prev => ({...prev, [organisationId]: {...res, loading: false}}));
      } catch (error) {
        console.warn(`[${logTag}] Failed to fetch rating status`, error);
        setOrgRatings(prev => ({...prev, [organisationId]: {isRated: false, loading: false}}));
      }
    },
    [logTag, orgRatings, setOrgRatings],
  );
