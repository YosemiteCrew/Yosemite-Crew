import { defineFunction } from '@aws-amplify/backend';

export const passwordlessDefineAuthChallenge = defineFunction({
  name: 'passwordless-define-auth-challenge',
  entry: './handler.ts',
  timeoutSeconds: 10,
  runtime: 18,
});
