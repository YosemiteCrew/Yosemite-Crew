import type { CreateAuthChallengeTriggerHandler } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const OTP_LENGTH = 4;
const OTP_METADATA_PREFIX = 'PASSWORDLESS_OTP';
const DEBUG_LOG_OTP = process.env.PASSWORDLESS_DEBUG_LOG_OTP === 'true';

const sesClient = new SESClient({});

const generateOtp = (length: number) => {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
};

const sendOtpEmail = async (email: string, otp: string) => {
  const fromEmail = process.env.PASSWORDLESS_OTP_EMAIL_FROM;
  const subject = process.env.PASSWORDLESS_OTP_EMAIL_SUBJECT ?? 'Your login code';

  if (!fromEmail) {
    if (DEBUG_LOG_OTP) {
      console.log(`DEBUG PASSWORDLESS OTP for ${email}:`, otp);
    }
    return;
  }

  const command = new SendEmailCommand({
    Source: fromEmail,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Text: {
          Data: `Your Yosemite Crew verification code is ${otp}. It expires in 10 minutes.`,
        },
      },
    },
  });

  await sesClient.send(command);
};

const resolveEmail = (event: Parameters<CreateAuthChallengeTriggerHandler>[0]): string | null => {
  const metadataEmail = event.request.clientMetadata?.loginEmail?.trim();
  if (metadataEmail && metadataEmail.includes('@')) {
    return metadataEmail.toLowerCase();
  }
  const userAttrs = event.request.userAttributes || {};
  if (userAttrs.email && userAttrs.email.trim().includes('@')) {
    return userAttrs.email.trim().toLowerCase();
  }
  if (userAttrs.preferred_username && userAttrs.preferred_username.trim().includes('@')) {
    return userAttrs.preferred_username.trim().toLowerCase();
  }
  if (event.userName && event.userName.trim().includes('@')) {
    return event.userName.trim().toLowerCase();
  }
  return null;
};

export const handler: CreateAuthChallengeTriggerHandler = async (event) => {
  console.log('Passwordless create-auth challenge invoked', {
    userName: event.userName,
    clientMetadata: event.request.clientMetadata,
    userAttributes: event.request.userAttributes,
  });

  const email = resolveEmail(event);

  if (!email) {
    console.error('Passwordless create-auth challenge missing email', {
      userName: event.userName,
      clientMetadata: event.request.clientMetadata,
      userAttributes: event.request.userAttributes,
    });
    throw new Error('Cannot issue passwordless challenge without an email address.');
  }

  console.log('Passwordless create-auth challenge resolved email', { email });

  const session = event.request.session ?? [];
  const previousChallenge = session[session.length - 1];
  const previousMetadata = previousChallenge?.challengeMetadata;
  const previousResult = previousChallenge?.challengeResult;

  let otp: string | null = null;
  let shouldSendEmail = true;

  if (
    previousMetadata?.startsWith(`${OTP_METADATA_PREFIX}:`) &&
    previousResult === false
  ) {
    const parts = previousMetadata.split(':');
    if (parts.length >= 2 && parts[1]) {
      otp = parts[1];
      shouldSendEmail = false;
    }
  }

  if (!otp) {
    otp = generateOtp(OTP_LENGTH);
    shouldSendEmail = true;
  }

  if (shouldSendEmail) {
    await sendOtpEmail(email, otp);
  }

  event.response.publicChallengeParameters = {
    deliveryMedium: 'EMAIL',
  };
  event.response.privateChallengeParameters = {
    answer: otp,
  };
  event.response.challengeMetadata = `${OTP_METADATA_PREFIX}:${otp}:${Date.now()}`;

  return event;
};
