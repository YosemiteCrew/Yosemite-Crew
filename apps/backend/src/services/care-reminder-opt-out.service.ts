import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { prisma } from "src/config/prisma";
import { stripTrailingSlash } from "src/utils/strip-trailing-slash";
import type { CareReminderOptOutChannel } from "@prisma/client";

/**
 * Opt-out plumbing for care reminders.
 *
 * Care reminders are sent to pet parents who never signed up for them directly:
 * the practice creates the reminder and we mail the address on file. Under GDPR
 * Art. 21 the recipient can object at any time, and an unsubscribe mechanism is
 * required by CAN-SPAM for anything that is not purely transactional. Neither
 * existed on this path, so every send needs both a suppression check and a link.
 *
 * Why this is separate from `marketing-unsubscribe.service`: that one writes to an
 * SES contact list and suppresses *marketing* mail globally. Objecting to one
 * practice's vaccination reminders is a different decision from leaving a mailing
 * list, and a parent whose animals are seen by two practices must be able to stop
 * one without silencing the other. The state therefore lives in our own table,
 * scoped by organisation, and does not depend on SES contact-list configuration.
 *
 * The token deliberately reuses `MARKETING_UNSUBSCRIBE_SECRET` (so no new secret
 * has to be provisioned before this can ship) but derives a different key from it.
 * Domain separation via the info string means a marketing token cannot be replayed
 * against this endpoint, or the reverse.
 */

const TOKEN_SEPARATOR = ".";
const TOKEN_VERSION = "v1";
const IV_BYTES = 12;
const KEY_DERIVATION_INFO = "care-reminder-opt-out-token-v1";

export class CareReminderOptOutConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CareReminderOptOutConfigError";
  }
}

export class InvalidCareReminderOptOutTokenError extends Error {
  constructor() {
    super("The unsubscribe link is invalid.");
    this.name = "InvalidCareReminderOptOutTokenError";
  }
}

const requireEnvironmentValue = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new CareReminderOptOutConfigError(`${name} is not configured.`);
  }
  return value;
};

export const normalizeOptOutEmail = (email: string): string =>
  email.trim().toLowerCase();

const deriveTokenKey = (): Buffer =>
  createHmac("sha256", requireEnvironmentValue("MARKETING_UNSUBSCRIBE_SECRET"))
    .update(KEY_DERIVATION_INFO)
    .digest();

export interface CareReminderOptOutTokenPayload {
  organisationId: string;
  email: string;
}

export const createCareReminderOptOutToken = (
  payload: CareReminderOptOutTokenPayload,
): string => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveTokenKey(), iv);
  const plaintext = JSON.stringify({
    o: payload.organisationId,
    e: normalizeOptOutEmail(payload.email),
  });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const sealed = Buffer.concat([ciphertext, cipher.getAuthTag()]);

  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    sealed.toString("base64url"),
  ].join(TOKEN_SEPARATOR);
};

export const readCareReminderOptOutToken = (
  token: string,
): CareReminderOptOutTokenPayload => {
  const parts = token.split(TOKEN_SEPARATOR);
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
    throw new InvalidCareReminderOptOutTokenError();
  }

  let decoded: string;
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const sealed = Buffer.from(parts[2], "base64url");
    // The GCM tag is the trailing 16 bytes; anything shorter cannot carry one.
    if (sealed.length <= 16) {
      throw new InvalidCareReminderOptOutTokenError();
    }
    const tag = sealed.subarray(sealed.length - 16);
    const ciphertext = sealed.subarray(0, sealed.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", deriveTokenKey(), iv);
    decipher.setAuthTag(tag);
    decoded = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    // A config error means the server is misconfigured, not that the caller sent a
    // bad link, so it must not be flattened into "invalid token".
    if (error instanceof CareReminderOptOutConfigError) throw error;
    throw new InvalidCareReminderOptOutTokenError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throw new InvalidCareReminderOptOutTokenError();
  }

  const record = parsed as { o?: unknown; e?: unknown };
  if (typeof record.o !== "string" || typeof record.e !== "string") {
    throw new InvalidCareReminderOptOutTokenError();
  }

  return { organisationId: record.o, email: record.e };
};

export const buildCareReminderUnsubscribeUrl = (
  payload: CareReminderOptOutTokenPayload,
): string => {
  const apiUrl = stripTrailingSlash(requireEnvironmentValue("PUBLIC_API_URL"));
  const token = createCareReminderOptOutToken(payload);
  return `${apiUrl}/v1/reminder-preferences/unsubscribe?token=${encodeURIComponent(token)}`;
};

/**
 * True when this address has objected to reminders on `channel` for this practice.
 * An `ALL` row suppresses every channel.
 */
export const isOptedOutOfCareReminders = async (params: {
  organisationId: string;
  email: string;
  channel: Exclude<CareReminderOptOutChannel, "ALL">;
}): Promise<boolean> => {
  const match = await prisma.careReminderOptOut.findFirst({
    where: {
      organisationId: params.organisationId,
      email: normalizeOptOutEmail(params.email),
      channel: { in: [params.channel, "ALL"] },
    },
    select: { id: true },
  });
  return match !== null;
};

export const recordCareReminderOptOut = async (params: {
  organisationId: string;
  email: string;
  channel?: CareReminderOptOutChannel;
  parentId?: string | null;
  source?: string;
}): Promise<void> => {
  const email = normalizeOptOutEmail(params.email);
  const channel = params.channel ?? "ALL";

  // Idempotent: clicking the same link twice, or a mail client prefetching it,
  // must not fail. The unique key is (organisationId, email, channel).
  await prisma.careReminderOptOut.upsert({
    where: {
      organisationId_email_channel: {
        organisationId: params.organisationId,
        email,
        channel,
      },
    },
    update: {
      parentId: params.parentId ?? undefined,
      source: params.source ?? undefined,
    },
    create: {
      organisationId: params.organisationId,
      email,
      channel,
      parentId: params.parentId ?? null,
      source: params.source ?? "unsubscribe-link",
    },
  });
};

export const unsubscribeFromCareReminders = async (
  token: string,
): Promise<CareReminderOptOutTokenPayload> => {
  const payload = readCareReminderOptOutToken(token);
  await recordCareReminderOptOut({
    organisationId: payload.organisationId,
    email: payload.email,
    channel: "ALL",
    source: "unsubscribe-link",
  });
  return payload;
};
