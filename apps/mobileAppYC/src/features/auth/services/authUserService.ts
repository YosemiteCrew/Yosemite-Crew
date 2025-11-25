import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import type {ParentProfileSummary} from '@/features/account/services/profileService';

const AUTH_USER_ENDPOINT = '/v1/authUser/signup';

export interface AuthUserRecord {
  _id: string;
  authProvider: string;
  providerUserId: string;
  email: string;
  parentId?: string | null;
}

export interface AuthUserParent {
  _id: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  email?: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  isProfileComplete?: boolean;
  linkedUserId?: string;
  address?: {
    addressLine?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface AuthUserSignupResponse {
  success: boolean;
  authUser: AuthUserRecord;
  parentLinked: boolean;
  parent?: AuthUserParent | null;
}

const normalizeParentSummary = (
  parent?: AuthUserParent | null,
): ParentProfileSummary | undefined => {
  if (!parent?._id) {
    return undefined;
  }

  return {
    id: parent._id,
    firstName: parent.firstName,
    lastName: parent.lastName,
    birthDate: parent.birthDate,
    phoneNumber: parent.phoneNumber,
    profileImageUrl: parent.profileImageUrl,
    isComplete: parent.isProfileComplete,
    address: parent.address
      ? {
          addressLine: parent.address.addressLine,
          city: parent.address.city,
          state: parent.address.state,
          postalCode: parent.address.postalCode,
          country: parent.address.country,
        }
      : undefined,
  };
};

export interface SyncAuthUserParams {
  authToken: string;
  idToken?: string;
}

export interface SyncAuthUserResult extends AuthUserSignupResponse {
  parentSummary?: ParentProfileSummary;
}

export const syncAuthUser = async ({
  authToken,
  idToken,
}: SyncAuthUserParams): Promise<SyncAuthUserResult> => {
  if (!authToken) {
    throw new Error('Missing auth token for auth sync.');
  }

  console.log('[AuthUserService] Sync request', {
    endpoint: AUTH_USER_ENDPOINT,
    usingIdToken: Boolean(idToken),
    timestamp: new Date().toISOString(),
  });

  const response = await apiClient.post<AuthUserSignupResponse>(AUTH_USER_ENDPOINT, undefined, {
    headers: withAuthHeaders(authToken, idToken ? {'X-ID-TOKEN': idToken} : undefined),
  });

  console.log('[AuthUserService] Sync response', {
    endpoint: AUTH_USER_ENDPOINT,
    status: response.status,
    data: response.data,
  });

  const parentSummary = normalizeParentSummary(response.data.parent);

  return {
    ...response.data,
    parentSummary,
  };
};
