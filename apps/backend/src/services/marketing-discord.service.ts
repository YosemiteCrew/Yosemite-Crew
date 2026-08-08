import logger from "src/utils/logger";

const DISCORD_INVITE_CODES = ["SwM6mX85KD", "yosemitecrew"];
const DISCORD_USER_AGENT = "DiscordBot (https://www.yosemitecrew.com, 1.0)";
const DISCORD_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedDiscordMembers: string | null = null;
let cachedAt = 0;
let inFlight: Promise<string | null> | null = null;

const readDiscordMembers = (invite: unknown): string | null => {
  if (!invite || typeof invite !== "object") return null;
  const data = invite as { approximate_member_count?: number };
  if (typeof data.approximate_member_count !== "number") return null;
  return data.approximate_member_count.toLocaleString("en-US");
};

const fetchDiscordMembers = async (): Promise<string | null> => {
  try {
    for (const inviteCode of DISCORD_INVITE_CODES) {
      const response = await fetch(
        `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": DISCORD_USER_AGENT,
          },
        },
      );

      if (!response.ok) {
        logger.warn("Discord invite lookup failed", {
          inviteCode,
          status: response.status,
        });
        continue;
      }

      const count = readDiscordMembers(await response.json());
      if (count !== null) return count;
    }
    return null;
  } catch (error) {
    logger.error("Failed to fetch Discord invite count", { error });
    return null;
  }
};

export const DiscordMembersService = {
  async getDiscordMembers(): Promise<string | null> {
    if (cachedDiscordMembers && Date.now() - cachedAt < DISCORD_CACHE_TTL_MS) {
      return cachedDiscordMembers;
    }

    inFlight ??= fetchDiscordMembers()
      .then((count) => {
        if (count !== null) {
          cachedDiscordMembers = count;
          cachedAt = Date.now();
        }
        return count;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  },
};
