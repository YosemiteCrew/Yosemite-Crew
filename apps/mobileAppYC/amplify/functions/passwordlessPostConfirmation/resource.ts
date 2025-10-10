import { defineFunction, secret } from '@aws-amplify/backend';

const customUserServiceUrl = secret('CUSTOM_USER_SERVICE_URL');

export const passwordlessPostConfirmation = defineFunction({
  name: 'passwordless-post-confirmation',
  entry: './handler.ts',
  timeoutSeconds: 10,
  environment: {
    CUSTOM_USER_SERVICE_URL: customUserServiceUrl,
  },
});
