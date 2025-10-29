import type {AuthProviderName, StoredAuthTokens} from '@/features/auth/services/tokenStorage';

export type AuthProvider = AuthProviderName;

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  profilePicture?: string;
  profileToken?: string;
  currency?: string;
  address?: {
    addressLine?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  };
}


export interface AuthTokens extends StoredAuthTokens {
  provider?: AuthProvider;
}

export interface NormalizedAuthTokens extends AuthTokens {
  provider: AuthProvider;
  userId: string;
  expiresAt?: number;
}

export type AuthStatus = 'idle' | 'initializing' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  initialized: boolean;
  user: User | null;
  provider: AuthProvider | null;
  sessionExpiry: number | null;
  lastRefresh: number | null;
  isRefreshing: boolean;
  error: string | null;
}
