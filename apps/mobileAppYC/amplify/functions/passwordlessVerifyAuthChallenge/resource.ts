import { defineFunction } from '@aws-amplify/backend';

export const passwordlessVerifyAuthChallenge = defineFunction({
  name: 'passwordless-verify-auth-challenge',
  entry: './handler.ts',
  timeoutSeconds: 10,
});
