const mockSesSend = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn().mockImplementation(() => ({send: mockSesSend})),
  SendEmailCommand: jest.fn().mockImplementation(input => ({input})),
}));

const DEMO_EMAIL = 'demo-review@example.test';
const DEMO_PASSWORD = 'demo-password-for-tests';

type Handler = (event: unknown) => Promise<{
  response: {
    publicChallengeParameters: {deliveryMedium: string; demoLogin: string};
    privateChallengeParameters: {answer: string; challengeType: string};
    challengeMetadata: string;
  };
}>;

const buildEvent = (email: string, session: unknown[] = []) => ({
  userName: email,
  request: {
    userAttributes: {email},
    clientMetadata: {},
    session,
  },
  response: {},
});

/**
 * The demo-login credentials are read at module load, so each case has to reset
 * the registry and re-require the handler with the environment it is asserting
 * about.
 */
const loadHandler = (env: Record<string, string | undefined>): Handler => {
  jest.resetModules();
  delete process.env.DEMO_LOGIN_EMAIL;
  delete process.env.DEMO_LOGIN_PASSWORD;
  delete process.env.PASSWORDLESS_OTP_EMAIL_FROM;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    process.env[key] = value;
  }

  return require('../../amplify/functions/passwordlessCreateAuthChallenge/handler')
    .handler as Handler;
};

describe('passwordlessCreateAuthChallenge demo-login gate', () => {
  const originalEnv = {...process.env};

  beforeEach(() => {
    mockSesSend.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('fully configured', () => {
    const env = {
      DEMO_LOGIN_EMAIL: DEMO_EMAIL,
      DEMO_LOGIN_PASSWORD: DEMO_PASSWORD,
      PASSWORDLESS_OTP_EMAIL_FROM: 'noreply@example.test',
    };

    it('answers the demo account with the configured password and sends no email', async () => {
      const handler = loadHandler(env);
      const result = await handler(buildEvent(DEMO_EMAIL));

      expect(result.response.privateChallengeParameters.answer).toBe(
        DEMO_PASSWORD,
      );
      expect(result.response.publicChallengeParameters.demoLogin).toBe('true');
      expect(result.response.publicChallengeParameters.deliveryMedium).not.toBe(
        'EMAIL',
      );
      expect(mockSesSend).not.toHaveBeenCalled();
    });

    it('still uses the normal OTP flow for any other address', async () => {
      const handler = loadHandler(env);
      const result = await handler(buildEvent('someone.else@example.test'));

      expect(result.response.privateChallengeParameters.answer).not.toBe(
        DEMO_PASSWORD,
      );
      expect(result.response.publicChallengeParameters.demoLogin).toBe('false');
      expect(result.response.publicChallengeParameters.deliveryMedium).toBe(
        'EMAIL',
      );
      expect(mockSesSend).toHaveBeenCalledTimes(1);
    });

    it('honours a prior DEMO_PASSWORD session', async () => {
      const handler = loadHandler(env);
      const result = await handler(
        buildEvent(DEMO_EMAIL, [
          {
            challengeMetadata: 'DEMO_PASSWORD:whatever:1',
            challengeResult: false,
          },
        ]),
      );

      expect(result.response.privateChallengeParameters.answer).toBe(
        DEMO_PASSWORD,
      );
      expect(mockSesSend).not.toHaveBeenCalled();
    });
  });

  describe('not configured', () => {
    it('falls back to the OTP flow for the demo address and never answers with an empty password', async () => {
      const handler = loadHandler({
        PASSWORDLESS_OTP_EMAIL_FROM: 'noreply@example.test',
      });
      const result = await handler(buildEvent(DEMO_EMAIL));

      expect(result.response.privateChallengeParameters.answer).not.toBe('');
      expect(result.response.publicChallengeParameters.demoLogin).toBe('false');
      expect(result.response.publicChallengeParameters.deliveryMedium).toBe(
        'EMAIL',
      );
      expect(mockSesSend).toHaveBeenCalledTimes(1);
    });

    it('does not let a forged DEMO_PASSWORD session yield an empty answer', async () => {
      const handler = loadHandler({
        PASSWORDLESS_OTP_EMAIL_FROM: 'noreply@example.test',
      });
      const result = await handler(
        buildEvent(DEMO_EMAIL, [
          {
            challengeMetadata: 'DEMO_PASSWORD:whatever:1',
            challengeResult: false,
          },
        ]),
      );

      expect(result.response.privateChallengeParameters.answer).not.toBe('');
      expect(result.response.privateChallengeParameters.challengeType).toBe(
        'PASSWORDLESS_OTP',
      );
    });
  });

  describe('partially configured', () => {
    it.each([
      ['only the email is set', {DEMO_LOGIN_EMAIL: DEMO_EMAIL}],
      ['only the password is set', {DEMO_LOGIN_PASSWORD: DEMO_PASSWORD}],
    ])('keeps the bypass disabled when %s', async (_label, partial) => {
      const handler = loadHandler({
        ...partial,
        PASSWORDLESS_OTP_EMAIL_FROM: 'noreply@example.test',
      });
      const result = await handler(buildEvent(DEMO_EMAIL));

      expect(result.response.publicChallengeParameters.demoLogin).toBe('false');
      expect(result.response.privateChallengeParameters.answer).not.toBe(
        DEMO_PASSWORD,
      );
      expect(result.response.privateChallengeParameters.answer).not.toBe('');
      expect(mockSesSend).toHaveBeenCalledTimes(1);
    });
  });
});
