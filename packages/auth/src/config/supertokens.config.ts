import type { TypeInput } from 'supertokens-node/types';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import EmailVerification from 'supertokens-node/recipe/emailverification';
import { getAuthAppInfo } from './appInfo.js';
import { getSmtpSettings } from './smtp.config.js';
import { SMTPService } from 'supertokens-node/recipe/emailpassword/emaildelivery';
import { SMTPService as EmailVerificationSMTPService } from 'supertokens-node/recipe/emailverification/emaildelivery';
import MultiFactorAuth from 'supertokens-node/recipe/multifactorauth';
import TOTP from 'supertokens-node/recipe/totp';

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`[auth] Missing required environment variable: ${name}`);
  }

  return value;
}

const smtpSettings = getSmtpSettings();

export function getSuperTokensConfig(): TypeInput {
  return {
    framework: 'express',
    supertokens: {
      connectionURI: requireEnv('SUPERTOKENS_CONNECTION_URI'),
      apiKey: process.env.SUPERTOKENS_API_KEY || undefined,
    },
    appInfo: getAuthAppInfo(),
    recipeList: [
      EmailPassword.init({
        emailDelivery: {
          service: new SMTPService({ smtpSettings }),
        },
      }),
      EmailVerification.init({
        mode: 'OPTIONAL',
        emailDelivery: {
          service: new EmailVerificationSMTPService({ smtpSettings }),
        },
      }),
      TOTP.init(),
      MultiFactorAuth.init({
        firstFactors: [MultiFactorAuth.FactorIds.EMAILPASSWORD],
      }),
      Session.init(),
    ],
  };
}
