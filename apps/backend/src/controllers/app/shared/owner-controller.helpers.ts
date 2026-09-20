import type { Request, Response } from "express";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { resolveVerifiedUserId } from "src/utils/request";

/**
 * Resolves the caller to the parent their records hang off.
 *
 * Returns null and sends the response, so callers must return without writing
 * again. Kept out of the handlers because every owner-facing read has to do
 * it, and doing it inline is how one of them ends up not doing it.
 */
export const resolveParentId = async (
  req: Request,
  res: Response,
): Promise<string | null> => {
  const authUserId = resolveVerifiedUserId(req);
  if (!authUserId) {
    res.status(401).json({ message: "Not authenticated: userId is missing." });
    return null;
  }

  const authUser = await AuthUserMobileService.getByProviderUserId(authUserId);
  const parentId = authUser?.parentId?.toString();
  if (!parentId) {
    res.status(404).json({ message: "User not found." });
    return null;
  }

  return parentId;
};
