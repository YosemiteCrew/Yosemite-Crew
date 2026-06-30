import axios from 'axios';

export function createApiClient() {
  const apiKey = process.env.YC_API_KEY;
  const baseURL = process.env.YC_API_BASE_URL ?? 'http://localhost:3000';

  if (!apiKey) {
    throw new Error('YC_API_KEY environment variable is required');
  }

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 30_000,
  });
}
