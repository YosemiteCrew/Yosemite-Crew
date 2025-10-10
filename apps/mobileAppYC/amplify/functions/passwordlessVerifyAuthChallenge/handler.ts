import type { VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda';

export const handler: VerifyAuthChallengeResponseTriggerHandler = async (event) => {
  const expectedAnswer = event.request.privateChallengeParameters?.answer;
  const providedAnswer = event.request.challengeAnswer?.trim();

  const isCorrect = Boolean(expectedAnswer && providedAnswer && expectedAnswer === providedAnswer);

  event.response.answerCorrect = isCorrect;

  return event;
};
