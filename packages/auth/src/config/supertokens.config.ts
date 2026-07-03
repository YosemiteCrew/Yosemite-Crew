import type { TypeInput } from 'supertokens-node/types';
import type { ProviderInput } from 'supertokens-node/recipe/thirdparty/types';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import EmailVerification from 'supertokens-node/recipe/emailverification';
import { getAuthAppInfo } from './appInfo.js';
import { getSmtpSettings } from './smtp.config.js';
import { SMTPService } from 'supertokens-node/recipe/emailpassword/emaildelivery';
import { SMTPService as EmailVerificationSMTPService } from 'supertokens-node/recipe/emailverification/emaildelivery';
import MultiFactorAuth from 'supertokens-node/recipe/multifactorauth';
import TOTP from 'supertokens-node/recipe/totp';
import Passwordless from 'supertokens-node/recipe/passwordless';
import ThirdParty from 'supertokens-node/recipe/thirdparty';
import UserMetadata from 'supertokens-node/recipe/usermetadata';
import AccountLinking from 'supertokens-node/recipe/accountlinking';
import { SMTPService as PasswordlessSMTPService } from 'supertokens-node/recipe/passwordless/emaildelivery';
import { getAuthHooks } from '../hooks.js';
import type { AuthProfile, LoginMethod } from '../types.js';

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`[auth] Missing required environment variable: ${name}`);
  }

  return value;
}

const SUPERTOKENS_API_KEY_FIELD = 'apiKey' as const;

// Keys this package stores on SuperTokens' userContext to carry login-flow
// facts from the recipe overrides into session creation and MFA policy.
const CTX_LOGIN_METHOD = 'ycLoginMethod';
const CTX_EMAIL = 'ycEmail';
const CTX_PROFILE = 'ycAuthProfile';

type MutableContext = Record<string, unknown>;

function defaultProfileForMethod(method: LoginMethod): AuthProfile {
  // Staff sign in with email+password; every other first factor (email OTP,
  // social) defaults to the pet-parent mobile product. Migrated staff using
  // the OTP first-login path are reclassified by the resolveAuthProfile hook.
  return method === 'emailpassword' ? 'pims_web' : 'pet_parent_mobile';
}

async function resolveProfile(input: {
  appUserId: string;
  email?: string;
  loginMethod: LoginMethod;
}): Promise<AuthProfile> {
  const hook = getAuthHooks().resolveAuthProfile;
  if (hook) {
    try {
      const resolved = await hook(input);
      if (resolved) {
        return resolved;
      }
    } catch (err) {
      console.error('[auth] resolveAuthProfile hook failed', err);
    }
  }
  return defaultProfileForMethod(input.loginMethod);
}

async function reportUserCreated(input: {
  appUserId: string;
  providerUserId: string;
  email?: string;
  loginMethod: LoginMethod;
}): Promise<void> {
  const hook = getAuthHooks().onUserCreated;
  if (!hook) {
    return;
  }
  const authProfile = await resolveProfile(input);
  try {
    await hook({ ...input, provider: 'supertokens', authProfile });
  } catch (err) {
    // Identity bookkeeping must never block a successful sign-up; the mapping
    // row is recoverable from provider data.
    console.error('[auth] onUserCreated hook failed', err);
  }
}

function isMfaRequirementEnabled(): boolean {
  // Escape hatch for CI/e2e environments only; defaults to enforced.
  return process.env.AUTH_REQUIRE_MFA !== 'false';
}

function buildThirdPartyProviders(): ProviderInput[] {
  const providers: ProviderInput[] = [];

  if (process.env.AUTH_GOOGLE_CLIENT_ID) {
    providers.push({
      config: {
        thirdPartyId: 'google',
        clients: [
          {
            clientId: requireEnv('AUTH_GOOGLE_CLIENT_ID'),
            clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
          },
        ],
      },
    });
  }

  if (process.env.AUTH_APPLE_CLIENT_ID) {
    providers.push({
      config: {
        thirdPartyId: 'apple',
        clients: [
          {
            // For native iOS sign-in this is the app bundle identifier.
            clientId: requireEnv('AUTH_APPLE_CLIENT_ID'),
            additionalConfig: {
              keyId: requireEnv('AUTH_APPLE_KEY_ID'),
              privateKey: requireEnv('AUTH_APPLE_PRIVATE_KEY'),
              teamId: requireEnv('AUTH_APPLE_TEAM_ID'),
            },
          },
        ],
      },
    });
  }

  if (process.env.AUTH_FACEBOOK_APP_ID) {
    providers.push({
      config: {
        thirdPartyId: 'facebook',
        clients: [
          {
            clientId: requireEnv('AUTH_FACEBOOK_APP_ID'),
            clientSecret: process.env.AUTH_FACEBOOK_APP_SECRET,
          },
        ],
      },
    });
  }

  return providers;
}

export function getSuperTokensConfig(): TypeInput {
  const supertokensApiKey = process.env.SUPERTOKENS_API_KEY;
  const smtpSettings = getSmtpSettings();
  const thirdPartyProviders = buildThirdPartyProviders();

  const firstFactors = [
    MultiFactorAuth.FactorIds.EMAILPASSWORD,
    'otp-email',
    ...(thirdPartyProviders.length > 0 ? [MultiFactorAuth.FactorIds.THIRDPARTY] : []),
  ];

  return {
    framework: 'express',
    supertokens: {
      connectionURI: requireEnv('SUPERTOKENS_CONNECTION_URI'),
      ...(supertokensApiKey ? { [SUPERTOKENS_API_KEY_FIELD]: supertokensApiKey } : undefined),
    },
    appInfo: getAuthAppInfo(),
    recipeList: [
      EmailPassword.init({
        emailDelivery: {
          service: new SMTPService({ smtpSettings }),
        },
        override: {
          functions: (original) => ({
            ...original,
            signUp: async (input) => {
              const ctx = input.userContext as MutableContext;
              ctx[CTX_LOGIN_METHOD] = 'emailpassword';
              ctx[CTX_EMAIL] = input.email;
              const result = await original.signUp(input);
              if (result.status === 'OK') {
                await reportUserCreated({
                  appUserId: result.user.id,
                  providerUserId: result.recipeUserId.getAsString(),
                  email: input.email,
                  loginMethod: 'emailpassword',
                });
              }
              return result;
            },
            signIn: async (input) => {
              const ctx = input.userContext as MutableContext;
              ctx[CTX_LOGIN_METHOD] = 'emailpassword';
              ctx[CTX_EMAIL] = input.email;
              return original.signIn(input);
            },
          }),
        },
      }),
      EmailVerification.init({
        // Parity with the previous provider: the account must verify its email
        // before using the product. Passwordless and social logins arrive
        // pre-verified; pre-provisioned users are imported as verified.
        mode: 'REQUIRED',
        emailDelivery: {
          service: new EmailVerificationSMTPService({ smtpSettings }),
        },
      }),
      TOTP.init(),
      MultiFactorAuth.init({
        firstFactors,
        override: {
          functions: (original) => ({
            ...original,
            getMFARequirementsForAuth: async (input) => {
              const ctx = input.userContext as MutableContext;
              const loginMethod = (ctx[CTX_LOGIN_METHOD] as LoginMethod | undefined) ?? 'unknown';

              let profile = ctx[CTX_PROFILE] as AuthProfile | undefined;
              if (!profile) {
                const user = await input.user;
                profile = await resolveProfile({
                  appUserId: user.id,
                  email: user.emails[0],
                  loginMethod,
                });
                ctx[CTX_PROFILE] = profile;
              }

              if (profile === 'pims_web' && isMfaRequirementEnabled()) {
                // Staff must complete a second factor. TOTP is the steady
                // state; email OTP doubles as the no-lockout first-login and
                // recovery factor during the migration window.
                return [{ oneOf: ['totp', 'otp-email'] }];
              }

              return original.getMFARequirementsForAuth(input);
            },
          }),
        },
      }),
      Passwordless.init({
        flowType: 'USER_INPUT_CODE',
        contactMethod: 'EMAIL',
        emailDelivery: {
          service: new PasswordlessSMTPService({
            smtpSettings,
          }),
        },
        override: {
          functions: (original) => ({
            ...original,
            consumeCode: async (input) => {
              const ctx = input.userContext as MutableContext;
              ctx[CTX_LOGIN_METHOD] = 'otp-email';
              const result = await original.consumeCode(input);
              if (result.status === 'OK') {
                const email = result.user.emails[0];
                ctx[CTX_EMAIL] = email;
                if (result.createdNewRecipeUser) {
                  await reportUserCreated({
                    appUserId: result.user.id,
                    providerUserId: result.recipeUserId.getAsString(),
                    email,
                    loginMethod: 'otp-email',
                  });
                }
              }
              return result;
            },
          }),
        },
      }),
      ...(thirdPartyProviders.length > 0
        ? [
            ThirdParty.init({
              signInAndUpFeature: { providers: thirdPartyProviders },
              override: {
                functions: (original) => ({
                  ...original,
                  signInUp: async (input) => {
                    const ctx = input.userContext as MutableContext;
                    const loginMethod = `thirdparty-${input.thirdPartyId}` as LoginMethod;
                    ctx[CTX_LOGIN_METHOD] = loginMethod;
                    ctx[CTX_EMAIL] = input.email;
                    const result = await original.signInUp(input);
                    if (result.status === 'OK' && result.createdNewRecipeUser) {
                      await reportUserCreated({
                        appUserId: result.user.id,
                        providerUserId: result.recipeUserId.getAsString(),
                        email: input.email,
                        loginMethod,
                      });
                    }
                    return result;
                  },
                }),
              },
            }),
          ]
        : []),
      // Required by MultiFactorAuth (factors are linked recipe users) and by
      // the migration's OTP first-login path: an email-OTP sign-in with a
      // verified email links into the pre-provisioned account instead of
      // creating a parallel user. Verification is required before linking to
      // prevent account takeover via unverified sign-ups.
      AccountLinking.init({
        shouldDoAutomaticAccountLinking: async () => ({
          shouldAutomaticallyLink: true,
          shouldRequireVerification: true,
        }),
      }),
      UserMetadata.init(),
      Session.init({
        override: {
          functions: (original) => ({
            ...original,
            createNewSession: async (input) => {
              const ctx = input.userContext as MutableContext;
              const loginMethod = (ctx[CTX_LOGIN_METHOD] as LoginMethod | undefined) ?? 'unknown';
              const email = ctx[CTX_EMAIL] as string | undefined;

              let profile = ctx[CTX_PROFILE] as AuthProfile | undefined;
              profile ??= await resolveProfile({
                appUserId: input.userId,
                email,
                loginMethod,
              });

              return original.createNewSession({
                ...input,
                accessTokenPayload: {
                  ...input.accessTokenPayload,
                  authProfile: profile,
                  loginMethod,
                  ...(email ? { sessionEmail: email } : undefined),
                },
              });
            },
          }),
        },
      }),
    ],
  };
}
