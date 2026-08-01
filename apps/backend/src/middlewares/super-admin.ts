import type { NextFunction, Request, Response } from "express";
import { getAuthService } from "@yosemite-crew/auth";
import type { AuthenticatedRequest } from "./auth";

const SUPER_ADMIN_ROLE = "superadmin";

export const requireSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authService = getAuthService();
  if (!authService) {
    res.status(503).json({ message: "Authentication service is not enabled" });
    return;
  }

  const authRequest = req as AuthenticatedRequest;
  const session = authRequest.authSession;

  if (!session) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const sessionRoles = (session.roles ?? []).map((role) =>
      role.trim().toLowerCase(),
    );
    const lookupUserId = session.providerUserId ?? session.appUserId;
    const lookupRoles =
      sessionRoles.length > 0
        ? []
        : (await authService.getUserRoles(lookupUserId)).map((role) =>
            role.trim().toLowerCase(),
          );
    const normalizedRoles =
      sessionRoles.length > 0 ? sessionRoles : lookupRoles;

    if (!normalizedRoles.includes(SUPER_ADMIN_ROLE)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
