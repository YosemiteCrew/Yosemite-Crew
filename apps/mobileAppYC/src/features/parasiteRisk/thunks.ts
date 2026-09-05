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

export const loadRiskForLocation = createAsyncThunk<
  {location: RiskLocation; reading: ParasiteRiskCellReading},
  RiskLocation,
  {rejectValue: string}
>('parasiteRisk/loadForLocation', async (location, {rejectWithValue}) => {
  try {
    const reading = await fetchRiskForLocation(location);
    return {location, reading};
  } catch {
    return rejectWithValue('parasiteRisk.errors.forecast');
  }
});

export const loadSubscriptions = createAsyncThunk<
  ParasiteRiskSubscriptionRecord[],
  void,
  {rejectValue: string}
>('parasiteRisk/loadSubscriptions', async (_, {rejectWithValue}) => {
  try {
    return await fetchSubscriptions();
  } catch {
    return rejectWithValue('parasiteRisk.errors.subscriptions');
  }
});

export const followLocation = createAsyncThunk<
  ParasiteRiskSubscriptionRecord,
  {location: RiskLocation; alertTier?: RiskTier},
  {rejectValue: string}
>('parasiteRisk/follow', async ({location, alertTier}, {rejectWithValue}) => {
  try {
    return await createSubscription(location, alertTier);
  } catch {
    return rejectWithValue('parasiteRisk.errors.follow');
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
  } catch {
    return rejectWithValue('parasiteRisk.errors.unfollow');
  }
});
