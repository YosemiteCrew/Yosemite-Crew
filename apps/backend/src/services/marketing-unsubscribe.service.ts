import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import SESV2 from "aws-sdk/clients/sesv2.js";

const TOKEN_SEPARATOR = ".";

/**
 * Token layout. v2 tokens are `v2.<iv>.<ciphertext+tag>` — the recipient address is
 * encrypted, not merely signed, so the link can travel through logs, referrer headers
 * and proxies without disclosing who it belongs to. Legacy tokens are
 * `<base64url(email)>.<hmac>`: still accepted on read so links already sitting in
 * inboxes keep working, but never minted. Once the legacy links have aged out (they
 * are only reachable from previously sent mail), `readLegacyToken` and its branch in
 * `readMarketingUnsubscribeToken` can be deleted.
 */
const TOKEN_VERSION_V2 = "v2";
const IV_BYTES = 12;
const KEY_DERIVATION_INFO = "marketing-unsubscribe-token-v2";

export class MarketingUnsubscribeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketingUnsubscribeConfigError";
  }
}

export class InvalidMarketingUnsubscribeTokenError extends Error {
  constructor() {
    super("The unsubscribe link is invalid.");
    this.name = "InvalidMarketingUnsubscribeTokenError";
  }
}

const requireEnvironmentValue = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new MarketingUnsubscribeConfigError(`${name} is not configured.`);
  }
  return value;
};

const resolveRegion = (): string =>
  process.env.AWS_SES_REGION?.trim() ||
  process.env.AWS_REGION?.trim() ||
  process.env.AWS_DEFAULT_REGION?.trim() ||
  "";

const createClient = (): SESV2 => {
  const region = resolveRegion();
  if (!region) {
    throw new MarketingUnsubscribeConfigError(
      "AWS region is not configured for SES.",
    );
  }

  return new SESV2({ region });
};

let client: SESV2 | undefined;

const getClient = (): SESV2 => {
  client ??= createClient();
  return client;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const signPayload = (payload: string): Buffer =>
  createHmac("sha256", requireEnvironmentValue("MARKETING_UNSUBSCRIBE_SECRET"))
    .update(payload)
    .digest();

const deriveTokenKey = (): Buffer =>
  createHmac("sha256", requireEnvironmentValue("MARKETING_UNSUBSCRIBE_SECRET"))
    .update(KEY_DERIVATION_INFO)
    .digest();

export const createMarketingUnsubscribeToken = (email: string): string => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveTokenKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalizeEmail(email), "utf8"),
    cipher.final(),
  ]);
  const sealed = Buffer.concat([ciphertext, cipher.getAuthTag()]);

  return [
    TOKEN_VERSION_V2,
    iv.toString("base64url"),
    sealed.toString("base64url"),
  ].join(TOKEN_SEPARATOR);
};

export const buildMarketingUnsubscribeUrl = (email: string): string => {
  const apiUrl = requireEnvironmentValue("PUBLIC_API_URL").replace(/\/+$/, "");
  const token = createMarketingUnsubscribeToken(email);
  return `${apiUrl}/v1/email-preferences/unsubscribe?token=${encodeURIComponent(token)}`;
};

const readLegacyToken = (payload: string, signature: string): string => {
  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(signature, "base64url");
  } catch {
    throw new InvalidMarketingUnsubscribeTokenError();
  }

  const expectedSignature = signPayload(payload);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new InvalidMarketingUnsubscribeTokenError();
  }

  const email = Buffer.from(payload, "base64url").toString("utf8");
  if (!email?.includes("@")) {
    throw new InvalidMarketingUnsubscribeTokenError();
  }
  return email;
};

const readV2Token = (iv: string, sealed: string): string => {
  let email: string;
  try {
    const sealedBytes = Buffer.from(sealed, "base64url");
    const tag = sealedBytes.subarray(-16);
    const ciphertext = sealedBytes.subarray(0, -16);

    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveTokenKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(tag);
    email = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // GCM authentication failure — a tampered or forged token.
    throw new InvalidMarketingUnsubscribeTokenError();
  }

  if (!email.includes("@")) {
    throw new InvalidMarketingUnsubscribeTokenError();
  }
  return email;
};

export const readMarketingUnsubscribeToken = (token: string): string => {
  const segments = token.split(TOKEN_SEPARATOR);

  if (segments.length === 3 && segments[0] === TOKEN_VERSION_V2) {
    const [, iv, sealed] = segments;
    if (!iv || !sealed) {
      throw new InvalidMarketingUnsubscribeTokenError();
    }
    return readV2Token(iv, sealed);
  }

  if (segments.length === 2) {
    const [payload, signature] = segments;
    if (!payload || !signature) {
      throw new InvalidMarketingUnsubscribeTokenError();
    }
    return readLegacyToken(payload, signature);
  }

  throw new InvalidMarketingUnsubscribeTokenError();
};

export const unsubscribeMarketingEmail = async (
  token: string,
): Promise<void> => {
  const email = readMarketingUnsubscribeToken(token);
  const contactListName = requireEnvironmentValue(
    "SES_MARKETING_CONTACT_LIST_NAME",
  );
  const ses = getClient();

  try {
    await ses
      .updateContact({
        ContactListName: contactListName,
        EmailAddress: email,
        UnsubscribeAll: true,
      })
      .promise();
  } catch (error) {
    if ((error as { code?: string }).code !== "NotFoundException") {
      throw error;
    }

    try {
      await ses
        .createContact({
          ContactListName: contactListName,
          EmailAddress: email,
          UnsubscribeAll: true,
        })
        .promise();
    } catch (createError) {
      if (
        (createError as { code?: string }).code !== "AlreadyExistsException"
      ) {
        throw createError;
      }
      await ses
        .updateContact({
          ContactListName: contactListName,
          EmailAddress: email,
          UnsubscribeAll: true,
        })
        .promise();
    }
  }
};

export const resetMarketingUnsubscribeClientForTests = (): void => {
  client = undefined;
};
