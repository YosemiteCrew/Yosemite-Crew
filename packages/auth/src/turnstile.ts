export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

/** A non-empty string no longer than a Turnstile token can be. */
export function isValidTurnstileToken(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= TURNSTILE_TOKEN_MAX_LENGTH
  );
}

/** Accepts both example.com and www.example.com; any other host only itself. */
export function allowedTurnstileHostnames(hostname: string): string[] {
  const host = hostname.trim().toLowerCase();
  if (!host) return [];
  const apex = host.startsWith('www.') ? host.slice(4) : host;
  if (apex.split('.').length !== 2) return [host];
  return [apex, `www.${apex}`];
}

export type VerifyTurnstileTokenInput = {
  token: string;
  secret: string;
  hostnames: readonly string[];
  action: string;
  remoteIp?: string;
};

/**
 * Asks Cloudflare whether a widget token is genuine, and accepts it only when it
 * was issued for the expected action on one of the expected hostnames. Any failure to
 * get a clear answer counts as a rejection.
 */
export async function verifyTurnstileToken(input: VerifyTurnstileTokenInput): Promise<boolean> {
  try {
    const body = new URLSearchParams({ secret: input.secret, response: input.token });
    if (input.remoteIp) body.set('remoteip', input.remoteIp);
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    return (
      result.success === true &&
      result.action === input.action &&
      typeof result.hostname === 'string' &&
      input.hostnames.includes(result.hostname)
    );
  } catch (error) {
    console.error('[auth] Turnstile verification failed', error);
    return false;
  }
}
