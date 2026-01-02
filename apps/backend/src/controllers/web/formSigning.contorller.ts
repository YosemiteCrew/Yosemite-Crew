import { Request, Response } from "express";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { FormSigningService } from "src/services/formSigning.service";

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId && typeof headerUserId === "string") {
    return headerUserId;
  }
  return authRequest.userId;
};


export const FormSigningController = {
  startSigning: async (req: Request, res: Response) => {
    try {
      const submissionId = req.params.submissionId;
      const userId = resolveUserIdFromRequest(req);

      const result = await FormSigningService.startSigning({
        submissionId,
        initiatedBy: userId,
      });

      res.status(200).json(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start signing";
      res.status(400).json({ message });
    }
  },

  startSigningMobile: async (req: Request, res: Response) => {
    try {
      const submissionId = req.params.submissionId;
      const userId = resolveUserIdFromRequest(req);

      const authUser = await AuthUserMobileService.getByProviderUserId(userId!);
      
      if (!authUser) {
        throw new Error("Unauthorized");
      }

      const result = await FormSigningService.startSigning({
        submissionId,
        initiatedBy: authUser.parentId?.toString(),
      });

      res.status(200).json(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start signing";
      res.status(400).json({ message });
    }
  },

  getSignedDocument: async (req: Request, res: Response) => {
    try {
      const submissionId = req.params.submissionId;
      
      const result = await FormSigningService.getSignedDocument({
        submissionId,
      });
      res.status(200).json(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to get signed document";
      res.status(400).json({ message });
    }
  },
};
