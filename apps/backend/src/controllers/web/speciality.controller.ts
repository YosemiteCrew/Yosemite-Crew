import { Request, Response } from "express";
import type { OrgRequest } from "src/middlewares/rbac";
import logger from "../../utils/logger";
import {
  fromSpecialityRequestDTO,
  toSpecialityBundleResponseDTO,
  toSpecialityResponseDTO,
  type Speciality,
  type SpecialityRequestDTO,
} from "@yosemite-crew/types";
import {
  CatalogService,
  CatalogServiceError,
} from "../../services/catalog.service";
import {
  SpecialityService,
  SpecialityServiceError,
  type SpecialityFHIRPayload,
} from "../../services/speciality.service";

const isFHIRSpecialityPayload = (
  payload: unknown,
): payload is SpecialityFHIRPayload => {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    (payload as { resourceType?: string }).resourceType === "Organization",
  );
};

const requireParam = (
  res: Response,
  value: string | undefined,
  message: string,
): value is string => {
  if (!value) {
    res.status(400).json({ message });
    return false;
  }
  return true;
};

const handleSpecialityError = (
  res: Response,
  error: unknown,
  logMessage: string,
  responseMessage: string,
) => {
  if (error instanceof CatalogServiceError) {
    if (error.code || error.details) {
      res.status(error.statusCode).json({
        error: {
          code: error.code ?? "CONFLICT",
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  if (error instanceof SpecialityServiceError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  logger.error(logMessage, error);
  res.status(500).json({ message: responseMessage });
};

const toFhirSpecialityResource = (
  summary: Awaited<ReturnType<typeof CatalogService.getSpecialityById>>,
): Speciality => ({
  _id: summary.id,
  organisationId: summary.organisationId,
  name: summary.name,
  headUserId: summary.headUserId ?? undefined,
  headName: summary.headName ?? undefined,
  headProfilePicUrl: summary.headProfilePicUrl ?? undefined,
  teamMemberIds: summary.teamMemberIds,
  isActive: summary.status === "ACTIVE",
  activeServiceCount: summary.activeServiceCount,
  activePackageCount: summary.activePackageCount,
  archivedServiceCount: summary.archivedServiceCount,
  archivedPackageCount: summary.archivedPackageCount,
  createdAt: summary.createdAt,
  updatedAt: summary.updatedAt,
});

export const SpecialityController = {
  create: async (req: Request, res: Response) => {
    try {
      const payload = req.body as SpecialityRequestDTO | undefined;

      if (!isFHIRSpecialityPayload(payload)) {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR Organization resource.",
        });
        return;
      }

      const speciality = fromSpecialityRequestDTO(payload);
      const created = await CatalogService.createSpeciality({
        organisationId: speciality.organisationId,
        name: speciality.name,
        headUserId: speciality.headUserId,
        headName: speciality.headName,
        headProfilePicUrl: speciality.headProfilePicUrl,
        teamMemberIds: speciality.teamMemberIds,
        isActive: speciality.isActive,
      });

      const response = await CatalogService.getSpecialityById(
        created.id,
        created.organisationId,
      );
      res
        .status(201)
        .json(toSpecialityResponseDTO(toFhirSpecialityResource(response)));
    } catch (error) {
      handleSpecialityError(
        res,
        error,
        "Failed to create speciality",
        "Unable to create speciality.",
      );
    }
  },

  createMany: async (req: Request, res: Response) => {
    try {
      const payloads = req.body as SpecialityFHIRPayload[];

      if (
        !Array.isArray(payloads) ||
        !payloads.every(isFHIRSpecialityPayload)
      ) {
        res.status(400).json({
          message:
            "Invalid payload list. Expected array of FHIR Organization resources.",
        });
        return;
      }

      const resources = await SpecialityService.createMany(payloads);
      res.status(201).json(resources);
    } catch (error) {
      handleSpecialityError(
        res,
        error,
        "Failed to create specialities",
        "Unable to create specialities.",
      );
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = req.body as SpecialityRequestDTO | undefined;

      if (!requireParam(res, id, "Speciality identifier is required.")) {
        return;
      }

      if (!isFHIRSpecialityPayload(payload)) {
        res.status(400).json({
          message: "Invalid payload. Expected FHIR Organization resource.",
        });
        return;
      }

      const speciality = fromSpecialityRequestDTO(payload);
      const updated = await CatalogService.updateSpeciality(id, {
        organisationId: speciality.organisationId,
        name: speciality.name,
        headUserId: speciality.headUserId,
        headName: speciality.headName,
        headProfilePicUrl: speciality.headProfilePicUrl,
        teamMemberIds: speciality.teamMemberIds,
        isActive: speciality.isActive,
      });

      const resource = await CatalogService.getSpecialityById(
        updated.id,
        updated.organisationId,
      );

      res
        .status(200)
        .json(toSpecialityResponseDTO(toFhirSpecialityResource(resource)));
    } catch (error) {
      handleSpecialityError(
        res,
        error,
        "Failed to update speciality",
        "Unable to update speciality.",
      );
    }
  },

  getSpecialityById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!requireParam(res, id, "Speciality identifier is required.")) {
        return;
      }

      const authorisedOrganisationId = (req as OrgRequest).organisationId;
      if (!authorisedOrganisationId) {
        res
          .status(400)
          .json({ message: "Organisation identifier is required." });
        return;
      }

      // `organization` is not one of the keys the org extractor reads, so a
      // value supplied here was never authorized. Honour it only when it agrees
      // with the organisation the caller was authorized for.
      const requestedOrganisationId =
        typeof req.query.organization === "string"
          ? req.query.organization.replace(/^Organization\//, "")
          : typeof req.query.organisationId === "string"
            ? req.query.organisationId
            : undefined;

      if (
        requestedOrganisationId &&
        requestedOrganisationId !== authorisedOrganisationId
      ) {
        res
          .status(403)
          .json({ message: "You are not associated with this organisation" });
        return;
      }

      const resource = await CatalogService.getSpecialityById(
        id,
        authorisedOrganisationId,
      );

      res
        .status(200)
        .json(toSpecialityResponseDTO(toFhirSpecialityResource(resource)));
    } catch (error) {
      handleSpecialityError(
        res,
        error,
        "Failed to retrieve speciality",
        "Unable to retrieve speciality.",
      );
    }
  },

  getAllByOrganizationId: async (req: Request, res: Response) => {
    try {
      const organisationId =
        typeof req.query.organization === "string"
          ? req.query.organization.replace(/^Organization\//, "")
          : typeof req.params.organisationId === "string"
            ? req.params.organisationId
            : undefined;

      if (
        !requireParam(
          res,
          organisationId,
          "Organization identifier is required.",
        )
      ) {
        return;
      }

      const active =
        typeof req.query.active === "string" ? req.query.active : undefined;
      const search =
        typeof req.query.name === "string" ? req.query.name : undefined;
      const summary = await CatalogService.listSpecialities(organisationId, {
        search,
        status:
          active === "false"
            ? "ARCHIVED"
            : active === "true"
              ? "ACTIVE"
              : undefined,
        page:
          typeof req.query.page === "string"
            ? Number.parseInt(req.query.page, 10)
            : undefined,
        pageSize:
          typeof req.query.pageSize === "string"
            ? Number.parseInt(req.query.pageSize, 10)
            : undefined,
      });

      const resources = summary.items.map((item) =>
        toFhirSpecialityResource(item),
      );

      res.status(200).json(
        toSpecialityBundleResponseDTO(resources, {
          baseUrl: `${req.baseUrl}`,
          searchMode: "match",
        }),
      );
    } catch (error) {
      handleSpecialityError(
        res,
        error,
        "Failed to retrieve specialities",
        "Unable to retrieve specialities.",
      );
    }
  },

  deleteSpeciality: async (req: Request, res: Response) => {
    try {
      const { organisationId, specialityId } = req.params;

      if (!organisationId || !specialityId) {
        res.status(400).json({
          message:
            "Organization identifier and Speciality identifier is required.",
        });
        return;
      }

      await CatalogService.deleteSpeciality(specialityId, organisationId);

      res.status(204).send();
    } catch (error) {
      handleSpecialityError(
        res,
        error,
        "Failed to delete speciality",
        "Unable to delete speciality.",
      );
    }
  },
};
