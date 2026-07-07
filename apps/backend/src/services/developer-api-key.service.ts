import { createHash, randomBytes } from "node:crypto";
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
// Rotation overlap: the rotated-out key keeps verifying for 24h so integrators
// can swap secrets without downtime, then behaves as revoked.
const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;

// Canonical v1 scope taxonomy (data-plane contract, section 4).
export const CANONICAL_V1_READ_SCOPES = [
  "appointments:read",
  "patients:read",
  "encounters:read",
  "invoices:read",
  "organization:read",
] as const;

const RESERVED_V1_WRITE_SCOPES = [
  "appointments:write",
  "patients:write",
  "invoices:write",
] as const;

// Reserved for the Phase 2 editing agent (ADR 0005, ai-editing-agent security
// model): read and draft-only write access to config-engine entities. They
// join ISSUABLE_SCOPES only when the agent surface ships - until then they are
// NOT issuable, and they never grant publish rights.
export const RESERVED_CONFIG_SCOPES = [
  "config:read",
  "config:draft:write",
] as const;

// Scopes a key can be issued with: the canonical v1 read list, the reserved
// v1.1 write scopes (issuable as explicit opt-ins, inert until their routes
// ship), and "*" for internal tooling (valid but never offered in the portal
// UI). Anything else - including the legacy coarse read/write/admin values and
// the Phase 2 config scopes - is rejected with a 400 at issuance.
export const ISSUABLE_SCOPES: readonly string[] = [
  ...CANONICAL_V1_READ_SCOPES,
  ...RESERVED_V1_WRITE_SCOPES,
  "*",
];

// Coarse scopes stored on pre-v1 keys expand at verification time so no data
// migration is needed (contract section 4). Expansion lives here, in verify,
// and nowhere else. "read"/"write" expand to the canonical v1 lists only; the
// Phase 2 config scopes are never granted implicitly.
const COARSE_SCOPE_EXPANSION: Record<string, readonly string[]> = {
  read: CANONICAL_V1_READ_SCOPES,
  write: [...CANONICAL_V1_READ_SCOPES, ...RESERVED_V1_WRITE_SCOPES],
  admin: ["*"],
};

export const expandApiKeyScopes = (stored: string[]): string[] => [
  ...new Set(
    stored.flatMap((scope) => COARSE_SCOPE_EXPANSION[scope] ?? [scope]),
  ),
];

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
  organisationId: string;
  scopes: string[];
  environment: DeveloperApiKeyEnvironment;
  // Non-empty means the auth middleware must reject client IPs not in the list.
  ipAllowlist: string[];
};

const hashApiKey = (plaintext: string) =>
  createHash("sha256").update(plaintext).digest("hex");

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

export const DeveloperApiKeyService = {
  async issue(input: {
    organisationId: string;
    name: string;
    createdBy: string;
    scopes?: string[];
    environment?: DeveloperApiKeyEnvironment;
    expiresAt?: Date | null;
    // Optional org the key should be scoped to instead of the caller's own.
    // Only the caller's seeded sandbox org is a valid target - anything else
    // is rejected, so this can never become arbitrary org targeting.
    targetOrganisationId?: string;
  }): Promise<IssuedApiKey> {
    let organisationId = requireNonEmpty(
      input.organisationId,
      "organisationId",
    );
    if (
      input.targetOrganisationId &&
      input.targetOrganisationId !== organisationId
    ) {
      const sandbox = await prisma.developerSandbox.findUnique({
        where: { organisationId },
        select: { sandboxOrganisationId: true },
      });
      if (sandbox?.sandboxOrganisationId !== input.targetOrganisationId) {
        throw new DeveloperApiKeyServiceError(
          "Keys can only be issued for your own organisation or its sandbox",
          403,
        );
      }
      organisationId = input.targetOrganisationId;
    }
    const name = requireNonEmpty(input.name, "name");
    const createdBy = requireNonEmpty(input.createdBy, "createdBy");
    const environment = input.environment ?? DeveloperApiKeyEnvironment.live;
    const scopes = (input.scopes ?? []).map((scope) =>
      requireNonEmpty(scope, "scope"),
    );
    for (const scope of scopes) {
      if (!ISSUABLE_SCOPES.includes(scope)) {
        throw new DeveloperApiKeyServiceError(`Unknown scope: ${scope}`, 400);
      }
    }

    const generated = generateApiKey(environment);
    const record = await prisma.developerApiKey.create({
      data: {
        organisationId,
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

  async list(organisationId: string) {
    const orgId = requireNonEmpty(organisationId, "organisationId");
    return prisma.developerApiKey.findMany({
      where: { organisationId: orgId },
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

  async revoke(input: {
    organisationId: string;
    keyId: string;
  }): Promise<void> {
    const organisationId = requireNonEmpty(
      input.organisationId,
      "organisationId",
    );
    const keyId = requireNonEmpty(input.keyId, "keyId");

    const result = await prisma.developerApiKey.updateMany({
      where: {
        id: keyId,
        organisationId,
        status: DeveloperApiKeyStatus.active,
      },
      data: { status: DeveloperApiKeyStatus.revoked, revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new DeveloperApiKeyServiceError("API key not found", 404);
    }
  },

  // Rotates a key: issues a replacement with the same scopes / environment /
  // controls and gives the old key a 24h grace window, after which verify()
  // treats it as revoked. The new key records the linkage via rotatedFromId.
  // A key can be rotated once; rotating an already-rotated key is a 409.
  async rotate(input: {
    organisationId: string;
    keyId: string;
    createdBy: string;
  }): Promise<IssuedApiKey> {
    const organisationId = requireNonEmpty(
      input.organisationId,
      "organisationId",
    );
    const keyId = requireNonEmpty(input.keyId, "keyId");
    const createdBy = requireNonEmpty(input.createdBy, "createdBy");

    const existing = await prisma.developerApiKey.findFirst({
      where: {
        id: keyId,
        organisationId,
        status: DeveloperApiKeyStatus.active,
      },
    });
    if (!existing) {
      throw new DeveloperApiKeyServiceError("API key not found", 404);
    }
    if (existing.rotationGraceUntil) {
      throw new DeveloperApiKeyServiceError("API key already rotated", 409);
    }

    const generated = generateApiKey(existing.environment);
    const graceUntil = new Date(Date.now() + ROTATION_GRACE_MS);
    const [record] = await prisma.$transaction([
      prisma.developerApiKey.create({
        data: {
          organisationId,
          name: existing.name,
          createdBy,
          scopes: existing.scopes,
          environment: existing.environment,
          ipAllowlist: existing.ipAllowlist,
          expiresAt: existing.expiresAt,
          rotatedFromId: existing.id,
          prefix: generated.prefix,
          hashedKey: generated.hashedKey,
          last4: generated.last4,
        },
      }),
      prisma.developerApiKey.update({
        where: { id: existing.id },
        data: { rotationGraceUntil: graceUntil },
      }),
    ]);

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

  // Authenticates a presented secret. Returns the org + scopes context, or null
  // for any unknown / revoked / expired key (callers translate null to 401).
  // A rotated-out key stays valid until its rotationGraceUntil instant, then
  // is treated exactly like a revoked key.
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
    if (
      record.rotationGraceUntil &&
      record.rotationGraceUntil.getTime() <= Date.now()
    ) {
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
      organisationId: record.organisationId,
      scopes: expandApiKeyScopes(record.scopes),
      environment: record.environment,
      ipAllowlist: record.ipAllowlist,
    };
  },
};
