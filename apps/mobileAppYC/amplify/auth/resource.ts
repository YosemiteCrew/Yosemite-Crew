import { defineAuth } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { passwordlessCreateAuthChallenge } from '../functions/passwordlessCreateAuthChallenge/resource';
import { passwordlessDefineAuthChallenge } from '../functions/passwordlessDefineAuthChallenge/resource';
import { passwordlessVerifyAuthChallenge } from '../functions/passwordlessVerifyAuthChallenge/resource';
import { passwordlessPreSignUp } from '../functions/passwordlessPreSignUp/resource';
import { passwordlessPostConfirmation } from '../functions/passwordlessPostConfirmation/resource';

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: 'CODE',
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
