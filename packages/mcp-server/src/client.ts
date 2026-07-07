import axios, { type AxiosInstance } from 'axios';

export const DEFAULT_BASE_URL = 'http://localhost:3000';

/**
 * Create the HTTP client for the Yosemite Crew developer data API
 * (the /v1/developer data plane, see docs/plans/developer-portal-data-api.md).
 *
 * - YC_API_KEY (required): a developer API key (yc_live_... or yc_test_...).
 * - YC_API_BASE_URL (optional): backend origin, defaults to http://localhost:3000.
 */
export function createApiClient(env: NodeJS.ProcessEnv = process.env): AxiosInstance {
  const apiKey = env.YC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'YC_API_KEY environment variable is required. Create an API key in the Yosemite Crew developer portal (/developers/api-keys) and set YC_API_KEY in the MCP server configuration.'
    );
  }

  const baseURL = env.YC_API_BASE_URL ?? DEFAULT_BASE_URL;

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 30_000,
  });
}
