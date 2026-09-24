export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

/** A non-empty string no longer than a Turnstile token can be. */
export function isValidTurnstileToken(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= TURNSTILE_TOKEN_MAX_LENGTH
  );
}

export type VerifyTurnstileTokenInput = {
  token: string;
  secret: string;
  hostname: string;
  action: string;
  remoteIp?: string;
};

/**
 * Asks Cloudflare whether a widget token is genuine, and accepts it only when it
 * was issued for the expected action on the expected hostname. Any failure to
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
      result.hostname === input.hostname
    );
  } catch (error) {
    console.error('[auth] Turnstile verification failed', error);
    return false;
  }
}
