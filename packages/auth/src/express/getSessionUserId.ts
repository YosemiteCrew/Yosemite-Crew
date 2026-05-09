import type { SessionRequest } from 'supertokens-node/framework/express';

export function getSessionUserId(req: SessionRequest): string {
  const userId = req.session?.getUserId();

  if (!userId) {
    throw new Error('[auth] Session user id is missing');
  }

  return userId;
}
