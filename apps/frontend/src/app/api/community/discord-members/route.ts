import { NextResponse } from 'next/server';

/**
 * Public Discord member count for the marketing surfaces (nav, footer, About,
 * Insights).
 *
 * This lives in the web app rather than being read from the product API for
 * three reasons, each of which has broken the number on the live site before:
 *
 *  - Same-origin. The browser calls `/api/...`, which `connect-src 'self'`
 *    already allows and which needs no CORS negotiation with the API domain.
 *  - No env var in the URL. Building the product-API URL by concatenating
 *    `NEXT_PUBLIC_BASE_URL` breaks whenever that value's trailing slash
 *    changes between environments.
 *  - No credentials and no session interceptor. This is public data; routing it
 *    through the authenticated axios client meant a 401 could bounce a visitor
 *    on a public page to the sign-in screen.
 *
 * It also keeps visitors' IPs out of Discord's hands: the lookup is made by the
 * server, never by the browser.
 */

// Both codes resolve to the same guild. Order matters: the first one to return a
// count wins. The raw invite code is primary - it is what the site, READMEs,
// dev-docs and issue templates publish, and it does not expire. The
// `yosemitecrew` vanity slug is a last-resort fallback only, and is currently
// DEAD ("Unknown Invite"): a vanity URL stops resolving once the guild loses its
// boost level, which is exactly what took the site's Discord link down. Kept
// here so the count survives if the vanity URL is ever restored - never publish
// it as a link.
const DISCORD_INVITE_CODES = ['SwM6mX85KD', 'yosemitecrew'];

// Discord requires a descriptive User-Agent on API calls and rate-limits or
// rejects generic ones.
const DISCORD_USER_AGENT = 'DiscordBot (https://www.yosemitecrew.com, 1.0)';

const CACHE_TTL_SECONDS = 300;

export interface DiscordMembersResponse {
  /** Localized member count, e.g. '1,204'. Null when the lookup failed. */
  discordMembers: string | null;
}

const readMemberCount = (invite: unknown): string | null => {
  if (!invite || typeof invite !== 'object') return null;
  const { approximate_member_count: count } = invite as { approximate_member_count?: number };
  if (typeof count !== 'number') return null;
  return count.toLocaleString('en-US');
};

const fetchMemberCount = async (inviteCode: string): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`,
      {
        headers: { Accept: 'application/json', 'User-Agent': DISCORD_USER_AGENT },
        // Deliberately uncached at the fetch layer. Next's data cache keys on the
        // request, not the outcome, so `revalidate` here would also cache a 200
        // that carries no member count (or malformed JSON) and keep replaying it
        // for the whole TTL after Discord recovered. Only a parsed count is
        // cached, and that happens below.
        cache: 'no-store',
      }
    );
    if (!response.ok) return null;
    return readMemberCount(await response.json());
  } catch {
    return null;
  }
};

export async function GET(): Promise<NextResponse<DiscordMembersResponse>> {
  for (const inviteCode of DISCORD_INVITE_CODES) {
    const discordMembers = await fetchMemberCount(inviteCode);
    if (discordMembers !== null) {
      // Caching lives entirely in this response header, never in module state.
      // Keyed on the outcome, so only a real count is ever cached: repeat traffic
      // is served by the CDN and the browser for the TTL, while a failure (below)
      // is cached nowhere and retried on the very next request.
      return NextResponse.json(
        { discordMembers },
        {
          headers: {
            'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS}`,
          },
        }
      );
    }
  }

  // 200 with a null count, not an error status: the caller treats a missing
  // count as "contribute nothing this pass" and keeps its loading placeholder.
  // Nothing about a failure is cached, at this layer or any other.
  return NextResponse.json({ discordMembers: null }, { headers: { 'Cache-Control': 'no-store' } });
}
