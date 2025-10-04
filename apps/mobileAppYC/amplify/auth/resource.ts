import { defineAuth, secret } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { passwordlessCreateAuthChallenge } from '../functions/passwordlessCreateAuthChallenge/resource';
import { passwordlessDefineAuthChallenge } from '../functions/passwordlessDefineAuthChallenge/resource';
import { passwordlessVerifyAuthChallenge } from '../functions/passwordlessVerifyAuthChallenge/resource';
import { passwordlessPreSignUp } from '../functions/passwordlessPreSignUp/resource';
import { passwordlessPostConfirmation } from '../functions/passwordlessPostConfirmation/resource';

const googleClientId = secret('GOOGLE_OAUTH_CLIENT_ID');
const googleClientSecret = secret('GOOGLE_OAUTH_CLIENT_SECRET');
const appleClientId = secret('APPLE_SERVICE_ID');
const appleTeamId = secret('APPLE_TEAM_ID');
const appleKeyId = secret('APPLE_KEY_ID');
const applePrivateKey = secret('APPLE_PRIVATE_KEY');

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: 'CODE',
    },
    externalProviders: {
      callbackUrls: [
        'yosemitecrew://auth/',
        'https://localhost/auth/callback',
      ],
      logoutUrls: [
        'yosemitecrew://signout/',
        'https://localhost/auth/signout',
      ],
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        scopes: ['email', 'profile'],
      },
      signInWithApple: {
        clientId: appleClientId,
        teamId: appleTeamId,
        keyId: appleKeyId,
        privateKey: applePrivateKey,
        scopes: ['name', 'email'],
      },
    },
  },
  userAttributes: {
    email: { required: true },
  },
  triggers: {
    createAuthChallenge: passwordlessCreateAuthChallenge,
    defineAuthChallenge: passwordlessDefineAuthChallenge,
    verifyAuthChallengeResponse: passwordlessVerifyAuthChallenge,
    preSignUp: passwordlessPreSignUp,
    postConfirmation: passwordlessPostConfirmation,
  },
});

// Type definitions don't expose the underlying Lambda resource yet; suppress to access it safely at runtime.
const passwordlessCreateAuthChallengeResource =
  passwordlessCreateAuthChallenge as unknown as {
    resources?: {
      lambda?: {
        grantPrincipal: {
          addToPrincipalPolicy: (statement: PolicyStatement) => void;
        };
      };
    };
  };

passwordlessCreateAuthChallengeResource.resources?.lambda?.grantPrincipal.addToPrincipalPolicy(
  new PolicyStatement({
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
  }),
);
