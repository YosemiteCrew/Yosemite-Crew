import apiClient, {
  withAuthHeaders,
} from '../../../src/shared/services/apiClient';
import {getFreshStoredTokens} from '../../../src/features/auth/sessionManager';
import {
  createSubscription,
  fetchRiskForLocation,
  fetchSubscriptions,
  removeSubscription,
} from '../../../src/features/parasiteRisk/services/parasiteRiskService';
import type {RiskLocation} from '../../../src/features/parasiteRisk/types';

// Automock, then set implementations below. A factory cannot be used here: the
// mock factory runs while the imports above are being evaluated, before any
// const in this file has initialised.
jest.mock('../../../src/shared/services/apiClient');
jest.mock('../../../src/features/auth/sessionManager');

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockDelete = apiClient.delete as jest.Mock;

// Deliberately an exact coordinate, to prove it never leaves the device.
const brisbane: RiskLocation = {
  label: 'Brisbane',
  lat: -27.4705,
  lon: 153.026,
  countryCode: 'AU',
};

describe('parasiteRiskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'token-123',
    });
    (withAuthHeaders as jest.Mock).mockImplementation((token: string) => ({
      Authorization: `Bearer ${token}`,
    }));
    mockGet.mockResolvedValue({data: {overallTier: 'HIGH'}});
    mockPost.mockResolvedValue({data: {id: 'sub-1'}});
    mockDelete.mockResolvedValue({data: undefined});
  });

  it('sends only the snapped grid cell, never the exact coordinate', async () => {
    await fetchRiskForLocation(brisbane);

    const [, config] = mockGet.mock.calls[0];
    expect(config.params.lat).toBe(-27.375);
    expect(config.params.lon).toBe(153.125);
    expect(config.params.lat).not.toBe(brisbane.lat);
    expect(config.params.lon).not.toBe(brisbane.lon);
  });

  it('attaches the bearer token', async () => {
    await fetchRiskForLocation(brisbane);

    const [, config] = mockGet.mock.calls[0];
    expect(config.headers.Authorization).toBe('Bearer token-123');
  });

  it('passes the country code when there is one', async () => {
    await fetchRiskForLocation(brisbane);
    expect(mockGet.mock.calls[0][1].params.countryCode).toBe('AU');
  });

  it('omits the country code on the current-location path', async () => {
    await fetchRiskForLocation({label: 'Here', lat: 41.9, lon: 12.5});

    expect(mockGet.mock.calls[0][1].params).not.toHaveProperty('countryCode');
  });

  it('refuses to call the API without an access token', async () => {
    (getFreshStoredTokens as jest.Mock).mockResolvedValue(null);

    await expect(fetchRiskForLocation(brisbane)).rejects.toThrow(
      /Missing access token/,
    );
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns the reading payload', async () => {
    await expect(fetchRiskForLocation(brisbane)).resolves.toEqual({
      overallTier: 'HIGH',
    });
  });

  it('lists followed locations', async () => {
    mockGet.mockResolvedValue({data: [{id: 'sub-1'}]});

    await expect(fetchSubscriptions()).resolves.toEqual([{id: 'sub-1'}]);
    expect(mockGet.mock.calls[0][0]).toBe('/v1/parasite-risk/subscriptions');
  });

  it('snaps the cell when following a location too', async () => {
    await createSubscription(brisbane);

    const [, body] = mockPost.mock.calls[0];
    expect(body.lat).toBe(-27.375);
    expect(body.lon).toBe(153.125);
    expect(body.label).toBe('Brisbane');
  });

  it('sends an alert tier only when one is chosen', async () => {
    await createSubscription(brisbane);
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('alertTier');

    mockPost.mockClear();
    await createSubscription(brisbane, 'EXTREME');
    expect(mockPost.mock.calls[0][1].alertTier).toBe('EXTREME');
  });

  it('deletes by subscription id', async () => {
    await removeSubscription('sub-9');
    expect(mockDelete.mock.calls[0][0]).toBe(
      '/v1/parasite-risk/subscriptions/sub-9',
    );
  });
});
