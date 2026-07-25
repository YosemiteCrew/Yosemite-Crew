import { Request, Response } from "express";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import logger from "src/utils/logger";
import { resolveUserIdFromRequest } from "src/utils/request";

// Resolve UserID

const KNOWN_AUTH_PROVIDERS = ["supertokens", "cognito", "firebase"] as const;
type KnownAuthProvider = (typeof KNOWN_AUTH_PROVIDERS)[number];

const isKnownAuthProvider = (value: unknown): value is KnownAuthProvider =>
  KNOWN_AUTH_PROVIDERS.includes(value as KnownAuthProvider);

export const AuthUserMobileController = {
  async signup(req: Request, res: Response) {
    try {
      const authRequest = req as AuthenticatedRequest;
      // Fixes a long-standing bug where a typo ("congito") classified every
      // mobile signup as firebase; the verified session's provider is now
      // stored as-is.
      const authProvider = authRequest.provider;
      if (!isKnownAuthProvider(authProvider)) {
        return res.status(401).json({
          success: false,
          message: "Unsupported auth provider",
        });
      }
      const authUser = await AuthUserMobileService.createOrGetAuthUser(
        authProvider,
        authRequest.userId!,
        authRequest.email!,
      );

      // Auto-link parent only when upstream provider confirms email ownership
      const parent = authRequest.emailVerified
        ? await AuthUserMobileService.autoLinkParentByEmail(authUser)
        : null;

      return res.status(200).json({
        success: true,
        authUser,
        parentLinked: !!parent,
        parent,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to sign up user.";
      logger.error(`${message}`);
      return res.status(500).json({ success: false, message });
    }
  },

  async linkParent(req: Request, res: Response) {
    try {
      const { parentId } = req.body as { parentId?: string };
      if (!parentId) {
        return res
          .status(400)
          .json({ success: false, message: "Parent ID is required" });
      }
      const authUserId = resolveUserIdFromRequest(req);
      const updatedUser = await AuthUserMobileService.linkParent(
        authUserId!,
        parentId,
      );

      return res.status(200).json({
        success: true,
        user: updatedUser,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to link parent.";
      return res.status(500).json({ success: false, message });
    }
  },

  async getByProvider(req: Request, res: Response) {
    try {
      const { providerUserId } = req.params;

      const user =
        await AuthUserMobileService.getByProviderUserId(providerUserId);

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      return res.status(200).json({ success: true, user });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to fetch user.";
      return res.status(500).json({ success: false, message });
    }
  },
};
