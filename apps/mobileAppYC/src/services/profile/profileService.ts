import {PASSWORDLESS_AUTH_CONFIG} from '@/config/auth';

export interface ProfileStatusRequest {
  accessToken: string;
  userId: string;
  email: string;
}

export type ProfileStatusSource = 'remote' | 'fallback' | 'mock';

export interface ProfileStatus {
  exists: boolean;
  profileToken: string;
  source: ProfileStatusSource;
}

const PROFILE_SERVICE_URL = PASSWORDLESS_AUTH_CONFIG.profileServiceUrl;

/**
 * Centralized helper to determine whether a user's profile already exists.
 * Falls back to mock data when the remote service is not configured or errors.
 */
export const fetchProfileStatus = async ({
  accessToken,
  userId,
  email,
}: ProfileStatusRequest): Promise<ProfileStatus> => {
  if (!PROFILE_SERVICE_URL) {
    return {
      exists: false,
      profileToken: `mock-profile-token-${userId}`,
      source: 'mock',
    };
  }

  try {
    const response = await fetch(`${PROFILE_SERVICE_URL}/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({userId, email}),
    });

    if (!response.ok) {
      return {
        exists: false,
        profileToken: `fallback-profile-token-${userId}`,
        source: 'fallback',
      };
    }

    const payload = await response.json().catch(() => ({}));

    return {
      exists: Boolean(payload?.exists),
      profileToken:
        typeof payload?.profileToken === 'string'
          ? payload.profileToken
          : `profile-token-${userId}`,
      source: 'remote',
    };
  } catch (error) {
    console.warn('[ProfileService] Profile status lookup failed; using mock token.', error);
    return {
      exists: false,
      profileToken: `mock-profile-token-${userId}`,
      source: 'mock',
    };
  }
};
