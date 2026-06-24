import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  UserOrganizationService,
  UserOrganizationServiceError,
  type UserOrganizationFHIRPayload,
} from "../../services/user-organization.service";
import { resolveUserIdFromRequest } from "src/utils/request";

const normalizeOrganisationReference = (value: string): string => {
  const trimmed = value.trim();
  // If the reference already starts with "Organization/" then remove "Organization/" prefix to avoid duplication, otherwise add it.
  return trimmed.startsWith("Organization/")
    ? trimmed.replace("Organization/", "")
    : trimmed;
};

const getOrganisationReference = (resource: unknown): string | undefined => {
  logger.debug("Extracting organization reference from resource", { resource });
  if (!resource) return undefined;

  if (Array.isArray(resource)) {
    const first = resource[0] as
      | { organizationReference?: unknown; mapping?: unknown }
      | undefined;
    if (first && typeof first.organizationReference === "string") {
      return first.organizationReference;
    }
    const firstMapping = first?.mapping as
      | { organizationReference?: unknown }
      | undefined;
    if (
      firstMapping &&
      typeof firstMapping.organizationReference === "string"
    ) {
      return firstMapping.organizationReference;
    }
    return undefined;
  }

  const candidate = resource as {
    organizationReference?: unknown;
    mapping?: unknown;
  };
  if (typeof candidate.organizationReference === "string") {
    return candidate.organizationReference;
  }

  const mapping = candidate.mapping as
    | { organizationReference?: unknown }
    | undefined;
  return typeof mapping?.organizationReference === "string"
    ? mapping.organizationReference
    : undefined;
};

const getPayloadOrganisationReference = (
  payload: UserOrganizationFHIRPayload,
): string | undefined => {
  // FHIR PractitionerRole carries the organisation as organization.reference.
  // Fall back to a flat organizationReference field if a caller still sends it.
  const candidate = payload as {
    organization?: { reference?: unknown };
    organizationReference?: unknown;
  };

  const nested = candidate.organization?.reference;
  if (typeof nested === "string" && nested.trim().length > 0) {
    return nested;
  }

  return typeof candidate.organizationReference === "string" &&
    candidate.organizationReference.trim().length > 0
    ? candidate.organizationReference
    : undefined;
};

const hasOrgAccess = async (userId: string, organisationReference: string) => {
  const normalizedTarget = normalizeOrganisationReference(
    organisationReference,
  );
  logger.debug("Checking organization access for user", {
    userId,
    organisationReference,
    normalizedTarget,
  });
  const mapping = await UserOrganizationService.getMappingByUserAndOrganization(
    userId,
    normalizedTarget,
  );

  return Boolean(mapping);
};

export const UserOrganizationController = {
  upsertMapping: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const payload = req.body as UserOrganizationFHIRPayload | undefined;

      if (payload?.resourceType !== "PractitionerRole") {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR PractitionerRole resource.",
        });
        return;
      }

      const payloadOrganisationReference =
        getPayloadOrganisationReference(payload);

      if (
        !payloadOrganisationReference ||
        !(await hasOrgAccess(userId, payloadOrganisationReference))
      ) {
        res.status(403).json({
          message: "You do not have access to this organisation.",
        });
        return;
      }

      const { response, created } =
        await UserOrganizationService.upsert(payload);
      res.status(created ? 201 : 200).json(response);
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to persist user-organization mapping", error);
      res
        .status(500)
        .json({ message: "Unable to persist user-organization mapping." });
    }
  },

  getMappingById: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({ message: "Mapping ID is required." });
        return;
      }

      const resource = await UserOrganizationService.getById(id);

      if (!resource || (Array.isArray(resource) && resource.length === 0)) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      const organisationReference = getOrganisationReference(resource);

      if (
        !organisationReference ||
        !(await hasOrgAccess(userId, organisationReference))
      ) {
        res.status(403).json({
          message: "You do not have access to this organisation.",
        });
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to retrieve user-organization mapping", error);
      res
        .status(500)
        .json({ message: "Unable to retrieve user-organization mapping." });
    }
  },

  listMappings: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const resources = await UserOrganizationService.listByUserId(userId);
      res.status(200).json(resources);
    } catch (error) {
      logger.error("Failed to list user-organization mappings", error);
      res
        .status(500)
        .json({ message: "Unable to list user-organization mappings." });
    }
  },

  deleteMappingById: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({ message: "Mapping ID is required." });
        return;
      }

      const existing = await UserOrganizationService.getById(id);
      if (!existing || (Array.isArray(existing) && existing.length === 0)) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      const organisationReference = getOrganisationReference(existing);
      if (
        !organisationReference ||
        !(await hasOrgAccess(userId, organisationReference))
      ) {
        res.status(403).json({
          message: "You do not have access to this organisation.",
        });
        return;
      }

      const deleted = await UserOrganizationService.deleteById(id);

      if (!deleted) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      res.status(200).json({ message: "Mapping deleted successfully." });
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to delete user-organization mapping", error);
      res
        .status(500)
        .json({ message: "Unable to delete user-organization mapping." });
    }
  },

  updateMappingById: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const { id } = req.params;
      const payload = req.body as UserOrganizationFHIRPayload | undefined;

      if (!id) {
        res.status(400).json({ message: "Mapping ID is required." });
        return;
      }

      if (payload?.resourceType !== "PractitionerRole") {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR PractitionerRole resource.",
        });
        return;
      }

      const payloadOrganisationReference =
        getPayloadOrganisationReference(payload);

      if (
        !payloadOrganisationReference ||
        !(await hasOrgAccess(userId, payloadOrganisationReference))
      ) {
        res.status(403).json({
          message: "You do not have access to this organisation.",
        });
        return;
      }

      const resource = await UserOrganizationService.update(id, payload);

      if (!resource) {
        res.status(404).json({ message: "Mapping not found." });
        return;
      }

      res.status(200).json(resource);
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to update user-organization mapping", error);
      res
        .status(500)
        .json({ message: "Unable to update user-organization mapping." });
    }
  },

  listMappingsForUser: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req); // this is the Cognito sub from the token

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: missing user id." });
        return;
      }

      const resources = await UserOrganizationService.listByUserId(userId);

      res.status(200).json(resources);
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error(
        "Failed to list current user's organization mappings",
        error,
      );
      res.status(500).json({
        message: "Unable to list current user's organization mappings.",
      });
    }
  },

  listByOrganisationId: async (req: Request, res: Response) => {
    try {
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        return res
          .status(401)
          .json({ message: "Unauthorized: missing user id." });
      }

      const { organisationId } = req.params;

      if (!organisationId) {
        return res.status(400).json({
          message: "Organisation Id is required and type should be string.",
        });
      }

      if (!(await hasOrgAccess(userId, organisationId))) {
        return res.status(403).json({
          message: "You do not have access to this organisation.",
        });
      }

      const result =
        await UserOrganizationService.listByOrganisationId(organisationId);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof UserOrganizationServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to list current organization's mappings", error);
      res.status(500).json({
        message: "Unable to list current user's organization mappings.",
      });
    }
  },
};
