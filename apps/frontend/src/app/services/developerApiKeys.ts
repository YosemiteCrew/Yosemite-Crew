import { getData, postData, deleteData } from '@/app/services/axios';

export type ApiKeyEnvironment = 'live' | 'test';
export type ApiKeyStatus = 'active' | 'revoked';

export interface DeveloperApiKey {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  environment: ApiKeyEnvironment;
  status: ApiKeyStatus;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface IssuedApiKey {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  environment: ApiKeyEnvironment;
  /** The plaintext secret, returned exactly once at creation. */
  apiKey: string;
}

export interface CreateApiKeyPayload {
  name: string;
  scopes?: string[];
  environment?: ApiKeyEnvironment;
  expiresAt?: string;
}

const BASE = '/v1/developers/api-keys';

export const listApiKeys = async (): Promise<DeveloperApiKey[]> => {
  const res = await getData<{ data: DeveloperApiKey[] }>(BASE);
  return res.data?.data ?? [];
};

export const createApiKey = async (payload: CreateApiKeyPayload): Promise<IssuedApiKey> => {
  const res = await postData<IssuedApiKey, CreateApiKeyPayload>(BASE, payload);
  return res.data;
};

export const revokeApiKey = async (id: string): Promise<void> => {
  await deleteData(`${BASE}/${id}`);
};
