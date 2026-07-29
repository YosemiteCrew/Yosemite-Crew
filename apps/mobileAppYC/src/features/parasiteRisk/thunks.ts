import {createAsyncThunk} from '@reduxjs/toolkit';
import type {
  ParasiteRiskCellReading,
  ParasiteRiskSubscriptionRecord,
  RiskLocation,
  RiskTier,
} from './types';
import {
  createSubscription,
  fetchRiskForLocation,
  fetchSubscriptions,
  removeSubscription,
} from './services/parasiteRiskService';

const messageFor = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const loadRiskForLocation = createAsyncThunk<
  {location: RiskLocation; reading: ParasiteRiskCellReading},
  RiskLocation,
  {rejectValue: string}
>('parasiteRisk/loadForLocation', async (location, {rejectWithValue}) => {
  try {
    const reading = await fetchRiskForLocation(location);
    return {location, reading};
  } catch (error) {
    return rejectWithValue(
      messageFor(error, 'We could not load the risk forecast for that place.'),
    );
  }
});

export const loadSubscriptions = createAsyncThunk<
  ParasiteRiskSubscriptionRecord[],
  void,
  {rejectValue: string}
>('parasiteRisk/loadSubscriptions', async (_, {rejectWithValue}) => {
  try {
    return await fetchSubscriptions();
  } catch (error) {
    return rejectWithValue(
      messageFor(error, 'We could not load your followed locations.'),
    );
  }
});

export const followLocation = createAsyncThunk<
  ParasiteRiskSubscriptionRecord,
  {location: RiskLocation; alertTier?: RiskTier},
  {rejectValue: string}
>('parasiteRisk/follow', async ({location, alertTier}, {rejectWithValue}) => {
  try {
    return await createSubscription(location, alertTier);
  } catch (error) {
    return rejectWithValue(
      messageFor(error, 'We could not follow that location.'),
    );
  }
});

export const unfollowLocation = createAsyncThunk<
  string,
  string,
  {rejectValue: string}
>('parasiteRisk/unfollow', async (subscriptionId, {rejectWithValue}) => {
  try {
    await removeSubscription(subscriptionId);
    return subscriptionId;
  } catch (error) {
    return rejectWithValue(
      messageFor(error, 'We could not unfollow that location.'),
    );
  }
});
