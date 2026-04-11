import type { Request } from "express";
import type { AuthenticatedRequest } from "src/middlewares/auth";

export const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const headerUserId = req.headers?.["x-user-id"];
  if (typeof headerUserId === "string") {
    const trimmedHeader = headerUserId.trim();
    if (trimmedHeader) return trimmedHeader;
  }

  const authRequest = req as AuthenticatedRequest;
  const userId = authRequest.userId;
  if (typeof userId === "string") {
    const trimmedUserId = userId.trim();
    return trimmedUserId || undefined;
  }

  return undefined;
};
