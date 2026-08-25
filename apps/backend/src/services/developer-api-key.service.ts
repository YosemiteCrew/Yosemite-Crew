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
  }): Promise<IssuedApiKey> {
    const organisationId = requireNonEmpty(
      input.organisationId,
      "organisationId",
    );
    const name = requireNonEmpty(input.name, "name");
    const createdBy = requireNonEmpty(input.createdBy, "createdBy");
    const environment = input.environment ?? DeveloperApiKeyEnvironment.live;
    const scopes = (input.scopes ?? []).map((scope) =>
      requireNonEmpty(scope, "scope"),
    );

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

  // Authenticates a presented secret. Returns the org + scopes context, or null
  // for any unknown / revoked / expired key (callers translate null to 401).
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
      scopes: record.scopes,
      environment: record.environment,
    };
  },
};
