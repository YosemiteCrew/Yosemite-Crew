import { Request, Response } from "express";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import logger from "src/utils/logger";

// Resolve UserID
const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId && typeof headerUserId === "string") {
    return headerUserId;
  }
  return authRequest.userId;
};

export const AuthUserMobileController = {
  async signup(req: Request, res: Response) {
    try {
      const authRequest = req as AuthenticatedRequest;
      const authProvider = authRequest.provider!;
      const authUser = await AuthUserMobileService.createOrGetAuthUser(
        authProvider == "congito" ? "cognito" : "firebase",
        authRequest.userId!,
        authRequest.email!,
      );

      // Auto-link parent if PMS already created a Parent with same email
      const parent =
        await AuthUserMobileService.autoLinkParentByEmail(authUser);

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
