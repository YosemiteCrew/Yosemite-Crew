import { createHmac, randomBytes } from "node:crypto";
import {
  DeveloperApiKeyEnvironment,
  DeveloperApiKeyStatus,
} from "@prisma/client";
import { prisma } from "src/config/prisma";

export class DeveloperApiKeyServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DeveloperApiKeyServiceError";
  }
}

const KEY_SECRET_BYTES = 24;
const LAST_USED_THROTTLE_MS = 60_000;

export type IssuedApiKey = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  environment: DeveloperApiKeyEnvironment;
  // The plaintext secret, returned exactly once at creation. Never persisted.
  apiKey: string;
};

export type VerifiedApiKey = {
  id: string;
  ownerUserId: string;
  scopes: string[];
  environment: DeveloperApiKeyEnvironment;
};

/**
 * Server-side secret mixed into every stored key digest.
 *
 * Read per call rather than captured at module load so a test or a process that
 * sets it after import still sees it, and so a missing value surfaces as a
 * request-time 500 rather than an import-time crash that would take down routes
 * having nothing to do with developer API keys.
 *
 * Fails closed on purpose. Falling back to an unkeyed digest would leave the
 * database readable by anyone holding a dump, while looking like it still worked.
 */
const apiKeyPepper = (): string => {
  const pepper = process.env.DEVELOPER_API_KEY_PEPPER;
  if (!pepper) {
    throw new DeveloperApiKeyServiceError(
      "DEVELOPER_API_KEY_PEPPER is not configured",
      500,
    );
  }
  return pepper;
};

/**
 * Keyed digest, not a bare hash.
 *
 * verify() looks the key up with an exact match on this value, so the digest has
 * to be deterministic - which rules out bcrypt/argon2/scrypt, whose per-record
 * salts make an indexed lookup impossible. HMAC keeps determinism while removing
 * the offline attack: a stolen DeveloperApiKeys dump cannot be brute-forced or
 * matched against precomputed digests without the pepper, which lives in the
 * environment rather than the database.
 *
 * SHA-256's speed is not the weakness here that it is for passwords - the input
 * is `yc_<env>_` plus 192 bits of CSPRNG output (KEY_SECRET_BYTES = 24), not a
 * human-chosen string, so guessing it is infeasible regardless of hash cost.
 * The pepper is what makes the stored value worthless on its own.
 */
const hashApiKey = (plaintext: string) =>
  createHmac("sha256", apiKeyPepper()).update(plaintext).digest("hex");

const generateApiKey = (environment: DeveloperApiKeyEnvironment) => {
  const secret = randomBytes(KEY_SECRET_BYTES).toString("base64url");
  const plaintext = `yc_${environment}_${secret}`;
  return {
    plaintext,
    hashedKey: hashApiKey(plaintext),
    prefix: `yc_${environment}_${secret.slice(0, 6)}`,
    last4: secret.slice(-4),
  };
};

const requireNonEmpty = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new DeveloperApiKeyServiceError(`Invalid ${field}`, 400);
  }
  return value.trim();
};

const MAX_ACTIVE_KEYS_PER_OWNER = 25;

export const DeveloperApiKeyService = {
  async issue(input: {
    ownerUserId: string;
    name: string;
    createdBy: string;
    scopes?: string[];
    environment?: DeveloperApiKeyEnvironment;
    expiresAt?: Date | null;
  }): Promise<IssuedApiKey> {
    const ownerUserId = requireNonEmpty(input.ownerUserId, "ownerUserId");
    const name = requireNonEmpty(input.name, "name");
    const createdBy = requireNonEmpty(input.createdBy, "createdBy");
    const environment = input.environment ?? DeveloperApiKeyEnvironment.live;
    const scopes = (input.scopes ?? []).map((scope) =>
      requireNonEmpty(scope, "scope"),
    );

    /*
     * Bound the number of live credentials one developer can hold.
     *
     * Issuing used to require `integrations:edit:any`, which only OWNER and
     * ADMIN carry. Scoping these routes to the developer removes that gate by
     * design - the resource is theirs - but it also means any account with a web
     * session can mint keys, so the ceiling that role incidentally provided has
     * to be stated explicitly rather than lost.
     *
     * Counts ACTIVE keys only, so revoking frees the budget.
     *
     * The count and the insert run inside one transaction behind a per-owner
     * advisory lock. Read Committed alone would let concurrent requests each
     * read the same sub-limit count and then all insert, so the ceiling would
     * only hold when requests happen not to overlap. The lock is taken on a
     * hash of the owner id, so it serialises one developer's key creation
     * without touching anyone else's, and is released when the transaction
     * ends either way.
     */
    const generated = generateApiKey(environment);
    const lockKey = `developer-api-key:${ownerUserId}`;
    const record = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // `verify` refuses a key past `expiresAt` and nothing ever moves it out
      // of `active`, so counting those would block an owner from issuing a
      // usable replacement while holding 25 credentials that authenticate
      // nothing. The ceiling is on live credentials, so match what `verify`
      // will actually accept.
      const activeKeys = await tx.developerApiKey.count({
        where: {
          ownerUserId,
          status: DeveloperApiKeyStatus.active,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (activeKeys >= MAX_ACTIVE_KEYS_PER_OWNER) {
        throw new DeveloperApiKeyServiceError(
          `Active API key limit reached (${MAX_ACTIVE_KEYS_PER_OWNER}). Revoke a key before creating another.`,
          429,
        );
      }

      return tx.developerApiKey.create({
        data: {
          ownerUserId,
          name,
          createdBy,
          scopes,
          environment,
          prefix: generated.prefix,
          hashedKey: generated.hashedKey,
          last4: generated.last4,
          expiresAt: input.expiresAt ?? null,
        },
      });
    });

    return {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      last4: record.last4,
      scopes: record.scopes,
      environment: record.environment,
      apiKey: generated.plaintext,
    };
  },

  async list(ownerUserId: string) {
    const ownerId = requireNonEmpty(ownerUserId, "ownerUserId");
    return prisma.developerApiKey.findMany({
      where: { ownerUserId: ownerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        last4: true,
        scopes: true,
        environment: true,
        status: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  },

  async revoke(input: { ownerUserId: string; keyId: string }): Promise<void> {
    const ownerUserId = requireNonEmpty(input.ownerUserId, "ownerUserId");
    const keyId = requireNonEmpty(input.keyId, "keyId");

    const result = await prisma.developerApiKey.updateMany({
      where: {
        id: keyId,
        ownerUserId,
        status: DeveloperApiKeyStatus.active,
      },
      data: { status: DeveloperApiKeyStatus.revoked, revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new DeveloperApiKeyServiceError("API key not found", 404);
    }
  },

  // Authenticates a presented secret. Returns the owner + scopes context, or
  // null for any unknown / revoked / expired key, or one whose owner account is
  // no longer active (callers translate null to 401).
  async verify(plaintextKey: string): Promise<VerifiedApiKey | null> {
    if (typeof plaintextKey !== "string" || !plaintextKey.startsWith("yc_")) {
      return null;
    }
    const record = await prisma.developerApiKey.findUnique({
      where: { hashedKey: hashApiKey(plaintextKey) },
    });
    if (!record || record.status !== DeveloperApiKeyStatus.active) {
      return null;
    }
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    // A deleted account is soft-deleted and its session is not revoked, so the
    // key it minted stays syntactically valid. The data API must not keep
    // answering for an owner who no longer exists.
    const owner = await prisma.user.findFirst({
      where: { userId: record.ownerUserId },
      select: { isActive: true },
    });
    if (!owner?.isActive) {
      return null;
    }

    const now = Date.now();
    if (
      !record.lastUsedAt ||
      now - record.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS
    ) {
      void prisma.developerApiKey
        .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }

    return {
      id: record.id,
      ownerUserId: record.ownerUserId,
      scopes: record.scopes,
      environment: record.environment,
    };
  },
};
