import axios, { type AxiosInstance } from 'axios';

/*
 * The backend listens on 4000 (apps/backend/.env.example). A wrong default here
 * costs a developer their first ten minutes to a connection error that looks
 * like a broken server, so it tracks that file rather than a convention.
 */
export const DEFAULT_BASE_URL = 'http://localhost:4000';

/**
 * HTTP client for the Yosemite Crew developer data plane (`/v1/developer`).
 *
 * - `YC_API_KEY` (required): a developer API key, `yc_live_…` or `yc_test_…`,
 *   created in the portal under `/developers/api-keys`.
 * - `YC_API_BASE_URL` (optional): backend origin.
 *
 * The key is sent as `Authorization: Bearer`. It identifies a PERSON, not a
 * practice: which practice a call reads is decided per request by the
 * `x-org-id` header, and the server re-checks the holder's live membership of
 * that practice every time. That is why no organisation is configured here.
 */
export function createApiClient(env: NodeJS.ProcessEnv = process.env): AxiosInstance {
  const apiKey = env.YC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'YC_API_KEY environment variable is required. Create an API key in the Yosemite Crew developer portal (/developers/api-keys) and set YC_API_KEY in the MCP server configuration.'
    );
  }

  return axios.create({
    baseURL: env.YC_API_BASE_URL ?? DEFAULT_BASE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 30_000,
  });
}

/** Per-request headers naming the practice a call acts for. */
export const orgHeaders = (organisationId: string) => ({
  headers: { 'x-org-id': organisationId },
});
