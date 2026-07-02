import { createHmac, timingSafeEqual } from "node:crypto";
import SESV2 from "aws-sdk/clients/sesv2.js";

const TOKEN_SEPARATOR = ".";

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

export const createMarketingUnsubscribeToken = (email: string): string => {
  const payload = Buffer.from(normalizeEmail(email), "utf8").toString(
    "base64url",
  );
  return `${payload}${TOKEN_SEPARATOR}${signPayload(payload).toString("base64url")}`;
};

export const buildMarketingUnsubscribeUrl = (email: string): string => {
  const apiUrl = requireEnvironmentValue("PUBLIC_API_URL").replace(/\/+$/, "");
  const token = createMarketingUnsubscribeToken(email);
  return `${apiUrl}/v1/email-preferences/unsubscribe?token=${encodeURIComponent(token)}`;
};

export const readMarketingUnsubscribeToken = (token: string): string => {
  const [payload, signature, extra] = token.split(TOKEN_SEPARATOR);
  if (!payload || !signature || extra) {
    throw new InvalidMarketingUnsubscribeTokenError();
  }

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
  if (!email || !email.includes("@")) {
    throw new InvalidMarketingUnsubscribeTokenError();
  }
  return email;
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
