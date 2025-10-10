import { defineFunction } from '@aws-amplify/backend';

export const passwordlessPreSignUp = defineFunction({
  name: 'passwordless-pre-sign-up',
  entry: './handler.ts',
  timeoutSeconds: 10,
});
