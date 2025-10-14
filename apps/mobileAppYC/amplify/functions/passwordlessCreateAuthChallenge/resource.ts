import { defineFunction, secret } from '@aws-amplify/backend';

const otpEmailFromAddress = secret('PASSWORDLESS_OTP_EMAIL_FROM');

export const passwordlessCreateAuthChallenge = defineFunction({
  name: 'passwordless-create-auth-challenge',
  entry: './handler.ts',
  timeoutSeconds: 10,
  environment: {
    PASSWORDLESS_OTP_EMAIL_FROM: otpEmailFromAddress,
    PASSWORDLESS_OTP_EMAIL_SUBJECT: 'Your Yosemite Crew login code',
    PASSWORDLESS_DEBUG_LOG_OTP: 'true',
  },
});
