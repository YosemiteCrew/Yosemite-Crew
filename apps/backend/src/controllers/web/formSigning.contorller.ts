import { Request, Response } from "express";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { FormSigningService } from "src/services/formSigning.service";
import type { AuthenticatedRequest } from "src/middlewares/auth";
import type { OrgRequest } from "src/middlewares/rbac";

export const FormSigningController = {
  startSigning: async (req: Request, res: Response) => {
    try {
      const submissionId = req.params.submissionId;
      // The acting user MUST come from the verified Cognito token, never from a
      // client-supplied header. authorizeCognito sets req.userId from token sub.
      const userId = (req as AuthenticatedRequest).userId;
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User ID missing" });
      }

      // withOrgPermissions() binds the authorised organisation from the request.
      const organisationId = (req as OrgRequest).organisationId;
      if (!organisationId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const result = await FormSigningService.startSigning({
        submissionId,
        initiatedBy: userId,
        organisationId,
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
      // The acting user MUST come from the verified Cognito token (token sub),
      // never from a client-supplied header.
      const userId = (req as AuthenticatedRequest).userId;
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Unauthorized: User ID missing" });
      }

      const authUser = await AuthUserMobileService.getByProviderUserId(userId);

      if (!authUser) {
        throw new Error("Unauthorized");
      }

      const result = await FormSigningService.startSigning({
        isParent: true,
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
