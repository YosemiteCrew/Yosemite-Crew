import type { AppInfo } from 'supertokens-node/types';

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`[auth] Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAuthAppInfo(): AppInfo {
  return {
    appName: process.env.AUTH_APP_NAME ?? 'Yosemite Crew',
    apiDomain: requireEnv('AUTH_API_DOMAIN'),
    websiteDomain: requireEnv('AUTH_WEBSITE_DOMAIN'),
    apiBasePath: process.env.AUTH_API_BASE_PATH ?? '/auth',
    websiteBasePath: process.env.AUTH_WEBSITE_BASE_PATH ?? '/auth',
  };
}
