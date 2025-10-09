import {PASSWORDLESS_AUTH_CONFIG} from '@/config/variables';

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

export interface BootstrapProfileRequest {
  accessToken: string;
  userId: string;
  email: string;
  provider: 'google' | 'apple' | 'facebook';
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface BootstrapProfileResponse {
  success: boolean;
  profileToken?: string;
}

const PROFILE_SERVICE_URL = PASSWORDLESS_AUTH_CONFIG.profileServiceUrl;
const PROFILE_BOOTSTRAP_URL = PASSWORDLESS_AUTH_CONFIG.profileBootstrapUrl;

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

export const bootstrapProfile = async ({
  accessToken,
  userId,
  email,
  provider,
  firstName,
  lastName,
  displayName,
  avatarUrl,
}: BootstrapProfileRequest): Promise<BootstrapProfileResponse> => {
  if (!PROFILE_BOOTSTRAP_URL) {
    console.warn(
      '[ProfileService] profileBootstrapUrl is not configured; skipping remote profile bootstrap.',
    );
    return {success: false};
  }

  try {
    const response = await fetch(PROFILE_BOOTSTRAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userId,
        email,
        provider,
        firstName,
        lastName,
        displayName,
        avatarUrl,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        message || 'Failed to bootstrap profile for social authentication.',
      );
    }

    const payload = await response.json().catch(() => ({}));

    return {
      success: true,
      profileToken:
        typeof payload?.profileToken === 'string'
          ? payload.profileToken
          : undefined,
    };
  } catch (error) {
    console.error('[ProfileService] Unable to bootstrap remote profile', error);
    return {success: false};
  }
};
