import {
  SESSION_EXPIRED_MESSAGE,
  toErrorMessage,
} from '@/shared/utils/serviceHelpers';

describe('toErrorMessage on an expired session', () => {
  // The reported bug: after an overnight idle the passport screen showed
  // "Request failed with status code 401" - axios's own message, surfaced
  // straight to a pet parent. The server's body is no better: SuperTokens
  // answers {"message":"try refresh token"}, which is an instruction to the
  // client, not to a person. Both must lose to the actionable message.
  it('prefers the actionable message over axios own text', () => {
    const axiosLike = {
      message: 'Request failed with status code 401',
      response: {status: 401, data: {}},
    };
    expect(toErrorMessage(axiosLike, 'fallback')).toBe(SESSION_EXPIRED_MESSAGE);
  });

  it('prefers it over the servers "try refresh token" too', () => {
    const axiosLike = {
      message: 'Request failed with status code 401',
      response: {status: 401, data: {message: 'try refresh token'}},
    };
    expect(toErrorMessage(axiosLike, 'fallback')).toBe(SESSION_EXPIRED_MESSAGE);
  });

  it('leaves other statuses alone', () => {
    const axiosLike = {
      message: 'Request failed with status code 403',
      response: {status: 403, data: {message: 'Ask the primary parent.'}},
    };
    expect(toErrorMessage(axiosLike, 'fallback')).toBe(
      'Ask the primary parent.',
    );
  });
});
