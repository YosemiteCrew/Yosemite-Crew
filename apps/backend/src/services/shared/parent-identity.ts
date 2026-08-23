import { prisma } from "src/config/prisma";

/**
 * The Parent row belonging to an authenticated mobile caller.
 *
 * `req.userId` is the AUTH PROVIDER's id - the SuperTokens `sub` - and it is
 * stored on `AuthUser.providerUserId`. `Parent.linkedUserId` holds something
 * else entirely: `linkParentIds` writes the AuthUser row's own primary key
 * (`authUser.id`) into it. Matching a request's userId directly against
 * `linkedUserId` therefore compares two different id spaces and never hits -
 * every one of the linked parents in production stores an `AuthUser.id` and
 * none stores a provider id, so the mistake fails closed for 100% of callers
 * rather than for an unlucky few.
 *
 * Going through AuthUser is the same route `parent.service` already takes for
 * the profile endpoints, which is why those work while the passport surface
 * did not.
 */
export const findParentIdForAuthUser = async (
  providerUserId: string,
): Promise<string | null> => {
  const authUser = await prisma.authUserMobile.findFirst({
    where: { providerUserId },
    select: { parentId: true },
  });
  return authUser?.parentId ?? null;
};
