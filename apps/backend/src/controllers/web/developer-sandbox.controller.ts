import type { Request, Response } from "express";
import type { OrgRequest } from "src/middlewares/rbac";
import {
  DeveloperSandboxService,
  DeveloperSandboxServiceError,
} from "src/services/developer-sandbox.service";
import logger from "src/utils/logger";
import { resolveUserIdFromRequest } from "src/utils/request";

// Management plane (session auth): create, inspect, and tear down the
// developer organisation's seeded demo clinic. Responses reuse the
// { data } / { message, code } envelopes of the sibling developer endpoints.

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

const respondMissingOrg = (res: Response): Response =>
  res.status(400).json({
    message: "Missing organisation context",
    code: "invalid_request",
  });

const respondError = (
  res: Response,
  action: string,
  error: unknown,
): Response => {
  if (error instanceof DeveloperSandboxServiceError) {
    return res.status(error.statusCode).json({
      message: error.message,
      code:
        error.code ??
        (error.statusCode === 404 ? "not_found" : "invalid_request"),
    });
  }
  logger.error(`DeveloperSandbox ${action} failed`, { error });
  return res
    .status(500)
    .json({ message: "Internal server error", code: "internal_error" });
};

export const DeveloperSandboxController = {
  // Idempotent: 201 on first creation, 200 with the existing sandbox after.
  createSandbox: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondMissingOrg(res);
    }
    try {
      const { sandbox, created } = await DeveloperSandboxService.create({
        organisationId,
        userId: resolveUserIdFromRequest(req),
      });
      return res.status(created ? 201 : 200).json({ data: sandbox });
    } catch (error) {
      return respondError(res, "create", error);
    }
  },

  getSandbox: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondMissingOrg(res);
    }
    try {
      const sandbox = await DeveloperSandboxService.get(organisationId);
      if (!sandbox) {
        return res
          .status(404)
          .json({ message: "Sandbox not found", code: "not_found" });
      }
      return res.status(200).json({ data: sandbox });
    } catch (error) {
      return respondError(res, "get", error);
    }
  },

  deleteSandbox: async (req: Request, res: Response): Promise<Response> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return respondMissingOrg(res);
    }
    try {
      await DeveloperSandboxService.teardown(organisationId);
      return res.status(204).send();
    } catch (error) {
      return respondError(res, "teardown", error);
    }
  },
};
