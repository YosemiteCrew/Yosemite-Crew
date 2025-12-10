import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

import logger from "./logger";

const {
  AWS_REGION,
  AWS_SES_REGION,
  SES_FROM_ADDRESS,
  EMAIL_FROM_ADDRESS,
  INVITE_EMAIL_FROM,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
} = process.env;

const resolveRegion = () => {
  return AWS_SES_REGION || AWS_REGION || process.env.AWS_DEFAULT_REGION;
};

const resolveSourceEmail = () => {
  return INVITE_EMAIL_FROM || SES_FROM_ADDRESS || EMAIL_FROM_ADDRESS;
};

const buildClient = () => {
  const region = resolveRegion();

  if (!region) {
    throw new Error("AWS region is not configured for SES.");
  }

  const credentials =
    AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        }
      : undefined;

  return new SESClient({
    region,
    credentials,
  });
};

let cachedClient: SESClient | null = null;

const getClient = () => {
  cachedClient ??= buildClient();

  return cachedClient;
};

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string | string[];
  sourceEmail?: string;
  configurationSetName?: string;
}

const normalizeAddresses = (
  value: string | string[] | undefined,
): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const addresses = Array.isArray(value) ? value : [value];
  return addresses.map((address) => address.trim()).filter(Boolean);
};

export const sendEmail = async (options: SendEmailOptions) => {
  const toAddresses = normalizeAddresses(options.to);

  if (!toAddresses?.length) {
    throw new Error("At least one recipient is required to send an email.");
  }

  const sourceEmail = options.sourceEmail ?? resolveSourceEmail();

  if (!sourceEmail) {
    throw new Error("Source email address is not configured.");
  }

  const subject = options.subject?.trim();

  if (!subject) {
    throw new Error("Email subject cannot be empty.");
  }

  const htmlBody = options.htmlBody?.trim();
  const textBody = options.textBody?.trim();

  if (!htmlBody && !textBody) {
    throw new Error("Either htmlBody or textBody must be provided.");
  }

  const replyToAddresses = normalizeAddresses(options.replyTo);

  const command = new SendEmailCommand({
    Source: sourceEmail,
    Destination: {
      ToAddresses: toAddresses,
    },
    ReplyToAddresses: replyToAddresses,
    Message: {
      Subject: {
        Data: subject,
        Charset: "UTF-8",
      },
      Body: {
        ...(textBody
          ? {
              Text: {
                Data: textBody,
                Charset: "UTF-8",
              },
            }
          : {}),
        ...(htmlBody
          ? {
              Html: {
                Data: htmlBody,
                Charset: "UTF-8",
              },
            }
          : {}),
      },
    },
    ConfigurationSetName: options.configurationSetName,
  });

  try {
    const result = await getClient().send(command);
    return result;
  } catch (error) {
    logger.error("Failed to send email via SES.", error);
    throw error;
  }
};

export default {
  sendEmail,
};
