import { getData, postData, putData, patchData } from '@/app/services/axios';
import type {
  APActorSettings,
  APFollower,
  APFollowing,
  APReferral,
  SendReferralPayload,
} from '../types/federation';

const BASE = '/ap/manage';

export const getActorSettings = async (): Promise<APActorSettings> => {
  const res = await getData<APActorSettings>(`${BASE}/actor`);
  return res.data;
};

export const followRemoteActor = (remoteActorUri: string) =>
  postData(`${BASE}/follow`, { remoteActorUri });

export const unfollowRemoteActor = (remoteActorUri: string) =>
  postData(`${BASE}/unfollow`, { remoteActorUri });

export const approveFollower = (remoteActorUri: string) =>
  postData(`${BASE}/followers/approve`, { remoteActorUri });

export const rejectFollower = (remoteActorUri: string) =>
  postData(`${BASE}/followers/reject`, { remoteActorUri });

export const listFollowers = async (): Promise<APFollower[]> => {
  const res = await getData<APFollower[]>(`${BASE}/followers`);
  return res.data;
};

export const listFollowing = async (): Promise<APFollowing[]> => {
  const res = await getData<APFollowing[]>(`${BASE}/following`);
  return res.data;
};

export const sendReferral = (payload: SendReferralPayload) =>
  postData(`${BASE}/referrals`, payload);

export const listInboundReferrals = async (): Promise<APReferral[]> => {
  const res = await getData<APReferral[]>(`${BASE}/referrals/inbound`);
  return res.data;
};

export const listOutboundReferrals = async (): Promise<APReferral[]> => {
  const res = await getData<APReferral[]>(`${BASE}/referrals/outbound`);
  return res.data;
};

export const updateLicenseToken = (token: string) => putData(`${BASE}/license-token`, { token });

export const sendNote = (toActorUri: string, content: string, inReplyTo?: string) =>
  postData(`${BASE}/notes`, { toActorUri, content, inReplyTo });

export const announceEmergency = (content: string, urgency?: string) =>
  postData(`${BASE}/announce`, { content, urgency });

export const respondToReferral = (referralId: string, action: 'accept' | 'decline') =>
  patchData(`${BASE}/referrals/${referralId}`, { action });

export const updateActorProfile = (opts: { summary?: string; iconUrl?: string }) =>
  putData(`${BASE}/actor`, opts);
