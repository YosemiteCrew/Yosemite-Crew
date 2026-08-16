import type { Request, Response } from "express";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { resolveUserIdFromRequest } from "src/utils/request";

export type ErrorWithStatus = Error & { statusCode?: number };

export const parseError = (
  err: unknown,
  fallbackMessage: string,
): { status: number; message: string } => {
  const statusCode =
    typeof err === "object" && err !== null && "statusCode" in err
      ? (err as ErrorWithStatus).statusCode
      : undefined;
  const status = typeof statusCode === "number" ? statusCode : 500;

  const message =
    err instanceof Error && err.message ? err.message : fallbackMessage;

  return { status, message };
};

export const sendAppointmentError = (
  res: Response,
  err: unknown,
  fallbackMessage: string,
) => {
  const { status, message } = parseError(err, fallbackMessage);
  return res.status(status).json({ message });
};

/**
 * Resolve the authenticated mobile caller's parent id. When the request is
 * unauthenticated or the user has no parent record, the matching error
 * response is written to `res` and `undefined` is returned so the handler can
 * bail out.
 */
export const resolveAuthedParentId = async (
  req: Request,
  res: Response,
): Promise<string | undefined> => {
  const authUserId = resolveUserIdFromRequest(req);
  if (!authUserId) {
    res.status(401).json({ message: "User not authenticated" });
    return undefined;
  }

  const authUser = await AuthUserMobileService.getByProviderUserId(authUserId);
  if (!authUser?.parentId) {
    res.status(400).json({ message: "Parent information missing for user" });
    return undefined;
  }

  return authUser.parentId.toString();
};
