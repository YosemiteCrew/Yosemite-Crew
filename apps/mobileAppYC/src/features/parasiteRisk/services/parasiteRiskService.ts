import {snapToRiskCell} from '@yosemite-crew/types';
import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import type {
  ParasiteRiskCellReading,
  ParasiteRiskSubscriptionRecord,
  RiskLocation,
  RiskTier,
} from '../types';

const BASE_PATH = '/v1/parasite-risk';

const authHeaders = async () => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  return withAuthHeaders(accessToken);
};

/**
 * Fetch the modelled risk for a location.
 *
 * The coordinate is snapped to its grid cell *before* it leaves the device, so
 * the server only ever sees the ~25km square, never the user's exact position.
 */
export const fetchRiskForLocation = async (
  location: RiskLocation,
): Promise<ParasiteRiskCellReading> => {
  const cell = snapToRiskCell(location.lat, location.lon);

  const response = await apiClient.get<ParasiteRiskCellReading>(BASE_PATH, {
    headers: await authHeaders(),
    params: {
      lat: cell.lat,
      lon: cell.lon,
      ...(location.countryCode ? {countryCode: location.countryCode} : {}),
    },
  });

  return response.data;
};

export const fetchSubscriptions = async (): Promise<
  ParasiteRiskSubscriptionRecord[]
> => {
  const response = await apiClient.get<ParasiteRiskSubscriptionRecord[]>(
    `${BASE_PATH}/subscriptions`,
    {headers: await authHeaders()},
  );

  return response.data;
};

export const createSubscription = async (
  location: RiskLocation,
  alertTier?: RiskTier,
): Promise<ParasiteRiskSubscriptionRecord> => {
  const cell = snapToRiskCell(location.lat, location.lon);

  const response = await apiClient.post<ParasiteRiskSubscriptionRecord>(
    `${BASE_PATH}/subscriptions`,
    {
      lat: cell.lat,
      lon: cell.lon,
      label: location.label,
      ...(location.countryCode ? {countryCode: location.countryCode} : {}),
      ...(alertTier ? {alertTier} : {}),
    },
    {headers: await authHeaders()},
  );

  return response.data;
};

export const removeSubscription = async (
  subscriptionId: string,
): Promise<void> => {
  await apiClient.delete(`${BASE_PATH}/subscriptions/${subscriptionId}`, {
    headers: await authHeaders(),
  });
};
