import type { NextFunction, Request, Response } from "express";
import { getAuthService } from "@yosemite-crew/auth";
import type { AuthenticatedRequest } from "./auth";

const normalizeRole = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;

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
    const metadata = await authService.getUserMetadata(session.appUserId);
    const role = normalizeRole(metadata.role);

    if (role !== "superadmin") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
