import type { DefineAuthChallengeTriggerHandler } from 'aws-lambda';

const MAX_CHALLENGE_ATTEMPTS = 3;
const OTP_METADATA_PREFIX = 'PASSWORDLESS_OTP';

export const handler: DefineAuthChallengeTriggerHandler = async (event) => {
  const session = event.request.session ?? [];
  const previousChallenge = session[session.length - 1];
  const successfulChallenge =
    previousChallenge?.challengeMetadata?.startsWith(OTP_METADATA_PREFIX) &&
    previousChallenge.challengeResult === true;

  if (successfulChallenge) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
    event.response.challengeName = undefined;
    return event;
  }

  const hasExceededAttempts =
    session.filter((challenge) => challenge.challengeName === 'CUSTOM_CHALLENGE').length >=
    MAX_CHALLENGE_ATTEMPTS;

  if (hasExceededAttempts) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    event.response.challengeName = undefined;
    return event;
  }

  event.response.challengeName = 'CUSTOM_CHALLENGE';
  event.response.issueTokens = false;
  event.response.failAuthentication = false;

  return event;
};
