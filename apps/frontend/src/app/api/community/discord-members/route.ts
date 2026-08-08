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

// Both the vanity code and the raw invite code resolve to the same guild. The
// vanity URL is the one published in the docs, but it only works while the guild
// keeps its boost level, so the raw code stays as the fallback.
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
        next: { revalidate: CACHE_TTL_SECONDS },
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
  // count as "contribute nothing this pass" and keeps its loading placeholder,
  // and a failed lookup should not be cached.
  return NextResponse.json({ discordMembers: null }, { headers: { 'Cache-Control': 'no-store' } });
}
