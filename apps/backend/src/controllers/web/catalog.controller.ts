import { Request, Response } from "express";
import { z } from "zod";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import logger from "src/utils/logger";
import {
  CatalogService,
  CatalogServiceError,
  type CatalogProductUpsertInput,
} from "src/services/catalog.service";
import {
  fromCatalogRequestDTO,
  fromCatalogResolveOperationRequestDTO,
  fromCatalogSearchOperationRequestDTO,
  type CatalogRequestDTO,
  toCatalogBundleResponseDTO,
  toCatalogResolveOperationResponseDTO,
  toCatalogResponseDTO,
  toCatalogSearchOperationResponseDTO,
} from "@yosemite-crew/types";

dayjs.extend(utc);

const productKindSchema = z.enum([
  "CONSULTATION",
  "PROCEDURE",
  "DIAGNOSTIC",
  "MEDICATION",
  "INVENTORY_ITEM",
  "LAB_TEST",
  "PACKAGE",
]);

const healthcareServiceSchema = z
  .object({
    resourceType: z.literal("HealthcareService"),
  })
  .passthrough();

const resolveSchema = z.object({
  productItemId: z.string().trim().min(1),
  organisationId: z.string().trim().min(1).optional(),
});

const parametersOperationSchema = z.object({
  resourceType: z.literal("Parameters"),
  parameter: z
    .array(
      z.object({
        name: z.string(),
        valueString: z.string().optional(),
        valueBoolean: z.boolean().optional(),
        valueInteger: z.number().int().optional(),
      }),
    )
    .optional(),
});

const parseIfMatchVersion = (req: Request): number | undefined => {
  const header =
    req.header?.("if-match") ?? req.header?.("If-Match") ?? undefined;
  if (!header) return undefined;

  const match = /(\d+)/.exec(header);
  if (match == null) {
    throw new CatalogServiceError("Invalid If-Match header.", 400);
  }

  return Number.parseInt(match[1] ?? "", 10);
};

const setVersionHeader = (res: Response, version?: number) => {
  if (version != null) {
    res.setHeader("ETag", `W/"${version}"`);
  }
};

const appointmentModesSchema = z
  .array(z.enum(["OUTPATIENT", "INPATIENT"]))
  .min(1)
  .optional();

const serviceMutationSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  kind: z
    .enum(["CONSULTATION", "PROCEDURE", "DIAGNOSTIC", "LAB_TEST"])
    .optional(),
  isBookable: z.boolean().optional(),
  appointmentModes: appointmentModesSchema,
  durationMinutes: z.number().int().positive().nullable().optional(),
  unitPrice: z.number().min(0).optional(),
  currency: z.string().trim().min(1).nullable().optional(),
  defaultDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  maxDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  code: z.string().trim().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

const packageBreakdownSchema = z.object({
  childItemId: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  pricingMode: z.enum(["INCLUDED", "INHERITED_PRICE", "OVERRIDE_PRICE"]),
  overridePrice: z.number().min(0).nullable().optional(),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  isOptional: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const packageMutationSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  isBookable: z.boolean().optional(),
  appointmentModes: appointmentModesSchema,
  durationMinutes: z.number().int().positive().nullable().optional(),
  unitPrice: z.number().min(0).optional(),
  currency: z.string().trim().min(1).nullable().optional(),
  defaultDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  maxDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  leadCount: z.number().int().min(0).optional(),
  supportCount: z.number().int().min(0).optional(),
  additionalDiscountPercent: z.number().min(0).max(100).optional(),
  code: z.string().trim().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  breakdown: z.array(packageBreakdownSchema).optional(),
});

const listQuerySchema = z.object({
  specialityId: z.string().trim().min(1).optional(),
  kinds: z.string().trim().optional(),
  search: z.string().trim().optional(),
  supportsInpatient: z
    .union([z.literal("true"), z.literal("false")])
    .optional(),
  includeInactive: z.union([z.literal("true"), z.literal("false")]).optional(),
  organization: z.string().trim().min(1).optional(),
  "provided-by": z.string().trim().min(1).optional(),
  specialty: z.string().trim().min(1).optional(),
  active: z.union([z.literal("true"), z.literal("false")]).optional(),
  name: z.string().trim().optional(),
  kind: z.string().trim().optional(),
  code: z.string().trim().optional(),
});

const specialityCatalogQuerySchema = z.object({
  tab: z.enum(["services", "packages", "all"]).optional(),
  search: z.string().trim().optional(),
  includeInactive: z.union([z.literal("true"), z.literal("false")]).optional(),
});

const summaryQuerySchema = z.object({
  search: z.string().trim().optional(),
  includeArchived: z.union([z.literal("true"), z.literal("false")]).optional(),
});

const specialityMutationSchema = z.object({
  name: z.string().trim().min(1).optional(),
  headUserId: z.string().trim().min(1).nullable().optional(),
  headName: z.string().trim().min(1).nullable().optional(),
  headProfilePicUrl: z.string().trim().url().nullable().optional(),
  teamMemberIds: z.array(z.string().trim().min(1)).optional(),
});

const specialitiesListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const serviceListQuerySchema = z.object({
  status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).optional(),
  search: z.string().trim().optional(),
  kind: z
    .enum(["CONSULTATION", "PROCEDURE", "DIAGNOSTIC", "LAB_TEST"])
    .optional(),
  isBookable: z.union([z.literal("true"), z.literal("false")]).optional(),
  supportsInpatient: z
    .union([z.literal("true"), z.literal("false")])
    .optional(),
});

const packageListQuerySchema = z.object({
  status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).optional(),
  search: z.string().trim().optional(),
  supportsInpatient: z
    .union([z.literal("true"), z.literal("false")])
    .optional(),
});

const itemSearchQuerySchema = z.object({
  q: z.string().trim().optional(),
  specialityId: z.string().trim().optional(),
  kinds: z.string().trim().optional(),
  includeArchived: z.union([z.literal("true"), z.literal("false")]).optional(),
  excludePackageId: z.string().trim().optional(),
  includeNestedBreakdown: z
    .union([z.literal("true"), z.literal("false")])
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const catalogNearbySearchQuerySchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().positive().optional(),
});

const catalogBookableSlotsSchema = z.object({
  productItemId: z.string().trim().min(1).optional(),
  serviceId: z.string().trim().min(1).optional(),
  date: z
    .string()
    .trim()
    .refine(
      (value) => dayjs.utc(value, "YYYY-MM-DD", true).isValid(),
      "Invalid date format (use YYYY-MM-DD)",
    ),
});

const catalogCalendarPrefillSchema = z.object({
  organisationId: z.string().trim().min(1),
  date: z
    .string()
    .trim()
    .refine(
      (value) => dayjs.utc(value, "YYYY-MM-DD", true).isValid(),
      "Invalid date format (use YYYY-MM-DD)",
    ),
  minuteOfDay: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 - 1),
  leadId: z.string().trim().min(1).optional(),
  productItemIds: z.array(z.string().trim().min(1)).min(1).optional(),
  serviceIds: z.array(z.string().trim().min(1)).min(1).optional(),
});

const handleError = (res: Response, error: unknown, defaultMessage: string) => {
  if (error instanceof CatalogServiceError) {
    if (error.code || error.details) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code ?? "CONFLICT",
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }

    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error(defaultMessage, error);
  return res.status(500).json({ message: defaultMessage });
};

const parseKinds = (value?: string) => {
  if (!value) return undefined;

  const rawKinds = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (rawKinds.length === 0) return undefined;

  return z.array(productKindSchema).parse(rawKinds);
};

const mapAppointmentModesToBookable = (params: {
  isBookable?: boolean;
  durationMinutes?: number | null;
  appointmentModes?: Array<"OUTPATIENT" | "INPATIENT">;
}) => {
  if (params.isBookable === false) {
    return null;
  }

  if (
    params.isBookable === true ||
    params.durationMinutes != null ||
    params.appointmentModes
  ) {
    return {
      durationMinutes: params.durationMinutes ?? 30,
      supportsOutpatient:
        params.appointmentModes?.includes("OUTPATIENT") ?? true,
      supportsInpatient:
        params.appointmentModes?.includes("INPATIENT") ?? false,
    };
  }

  return undefined;
};

const mapPricePolicy = (input: {
  unitPrice?: number;
  currency?: string | null;
  defaultDiscountPercent?: number | null;
  maxDiscountPercent?: number | null;
}) => {
  if (
    input.unitPrice === undefined &&
    input.currency === undefined &&
    input.defaultDiscountPercent === undefined &&
    input.maxDiscountPercent === undefined
  ) {
    return undefined;
  }

  return {
    unitPrice: input.unitPrice ?? 0,
    currency: input.currency ?? null,
    defaultDiscountPercent: input.defaultDiscountPercent ?? null,
    maxDiscountPercent: input.maxDiscountPercent ?? null,
  };
};

const toServiceUpsertInput = (params: {
  organisationId: string;
  specialityId?: string;
  payload: z.infer<typeof serviceMutationSchema>;
}): CatalogProductUpsertInput => ({
  organisationId: params.organisationId,
  specialityId: params.specialityId,
  name: params.payload.name ?? "",
  description: params.payload.description ?? null,
  code: params.payload.code ?? null,
  kind: params.payload.kind ?? "CONSULTATION",
  isActive: params.payload.isActive,
  price: mapPricePolicy(params.payload),
  bookable: mapAppointmentModesToBookable(params.payload),
});

const toPackageUpsertInput = (params: {
  organisationId: string;
  specialityId?: string;
  payload: z.infer<typeof packageMutationSchema>;
}): CatalogProductUpsertInput => ({
  organisationId: params.organisationId,
  specialityId: params.specialityId,
  name: params.payload.name ?? "",
  description: params.payload.description ?? null,
  code: params.payload.code ?? null,
  kind: "PACKAGE",
  isActive: params.payload.isActive,
  price: mapPricePolicy(params.payload),
  bookable: mapAppointmentModesToBookable(params.payload),
  packageItems:
    params.payload.breakdown?.map((item) => ({
      childProductItemId: item.childItemId,
      quantity: item.quantity,
      pricingMode: item.pricingMode,
      overridePrice: item.overridePrice ?? null,
      discountPercent: item.discountPercent ?? null,
      sortOrder: item.sortOrder,
      isOptional: item.isOptional,
    })) ?? [],
  package:
    params.payload.leadCount != null ||
    params.payload.supportCount != null ||
    params.payload.additionalDiscountPercent != null
      ? {
          leadCount: params.payload.leadCount ?? 1,
          supportCount: params.payload.supportCount ?? 0,
          additionalDiscountPercent:
            params.payload.additionalDiscountPercent ?? 0,
          grossAmount: 0,
          itemDiscountAmount: 0,
          additionalDiscountAmount: 0,
          breakdownItemCount: params.payload.breakdown?.length ?? 0,
        }
      : undefined,
});

export const CatalogController = {
  createProduct: async (
    req: Request<unknown, unknown, CatalogRequestDTO>,
    res: Response,
  ) => {
    try {
      const parsed = healthcareServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR HealthcareService resource.",
          errors: parsed.error.flatten(),
        });
      }

      const created = await CatalogService.createProduct(
        fromCatalogRequestDTO(parsed.data),
      );
      setVersionHeader(res, created.version);
      return res.status(201).json(toCatalogResponseDTO(created));
    } catch (error) {
      return handleError(res, error, "Unable to create catalog product.");
    }
  },

  updateProduct: async (
    req: Request<{ id: string }, unknown, CatalogRequestDTO>,
    res: Response,
  ) => {
    try {
      const parsed = healthcareServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid payload. Expected FHIR HealthcareService resource.",
          errors: parsed.error.flatten(),
        });
      }

      const updated = await CatalogService.updateProduct(req.params.id, {
        ...fromCatalogRequestDTO(parsed.data),
        expectedVersion: parseIfMatchVersion(req),
      });
      setVersionHeader(res, updated.version);
      return res.status(200).json(toCatalogResponseDTO(updated));
    } catch (error) {
      return handleError(res, error, "Unable to update catalog product.");
    }
  },

  getProductById: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const organisationId =
        typeof req.query.organisationId === "string"
          ? req.query.organisationId
          : undefined;
      const product = await CatalogService.getProductById(
        req.params.id,
        organisationId,
      );
      setVersionHeader(res, product.version);
      return res.status(200).json(toCatalogResponseDTO(product));
    } catch (error) {
      return handleError(res, error, "Unable to fetch catalog product.");
    }
  },

  getPackageDetail: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const organisationId =
        typeof req.query.organisationId === "string"
          ? req.query.organisationId
          : undefined;
      const pkg = await CatalogService.getPackageDetail(
        req.params.id,
        organisationId,
      );
      setVersionHeader(res, pkg.version);
      return res.status(200).json(pkg);
    } catch (error) {
      return handleError(res, error, "Unable to fetch catalog package.");
    }
  },

  listProducts: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ) => {
    try {
      const isFhirRoute = req.baseUrl.includes("/fhir/");
      const queryResult = listQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({
          message: "Invalid catalog list query.",
          errors: queryResult.error.flatten(),
        });
      }

      const products = await CatalogService.listProducts({
        organisationId:
          queryResult.data.organization ??
          queryResult.data["provided-by"] ??
          req.params.organisationId,
        specialityId:
          queryResult.data.specialty ?? queryResult.data.specialityId,
        kinds: parseKinds(queryResult.data.kind ?? queryResult.data.kinds),
        active:
          queryResult.data.active === "true"
            ? true
            : queryResult.data.active === "false"
              ? false
              : undefined,
        supportsInpatient:
          queryResult.data.supportsInpatient === "true"
            ? true
            : queryResult.data.supportsInpatient === "false"
              ? false
              : undefined,
        includeInactive:
          queryResult.data.includeInactive === "true" ||
          (isFhirRoute && queryResult.data.active === undefined),
        search:
          queryResult.data.code ??
          queryResult.data.name ??
          queryResult.data.search,
      });

      return res.status(200).json(
        toCatalogBundleResponseDTO(products, {
          baseUrl: `${req.baseUrl}`,
          searchMode: "match",
        }),
      );
    } catch (error) {
      return handleError(res, error, "Unable to list catalog products.");
    }
  },

  getSpecialityCatalog: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = specialityCatalogQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid speciality catalog query.",
          errors: parsed.error.flatten(),
        });
      }

      const result = await CatalogService.getSpecialityCatalog({
        organisationId: req.params.organisationId,
        specialityId: req.params.specialityId,
        tab: parsed.data.tab,
        search: parsed.data.search,
        includeInactive: parsed.data.includeInactive === "true",
      });

      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error, "Unable to fetch speciality catalog.");
    }
  },

  resolveProduct: async (req: Request, res: Response) => {
    try {
      const parsed = resolveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid catalog resolve payload.",
          errors: parsed.error.flatten(),
        });
      }

      const result = await CatalogService.resolveSelection(
        parsed.data.productItemId,
        parsed.data.organisationId,
      );

      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error, "Unable to resolve catalog product.");
    }
  },

  resolveProductOperation: async (req: Request, res: Response) => {
    try {
      const parsed = parametersOperationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid FHIR Parameters payload.",
          errors: parsed.error.flatten(),
        });
      }

      const operationInput = fromCatalogResolveOperationRequestDTO(parsed.data);

      const result = await CatalogService.resolveSelection(
        operationInput.productItemId,
        operationInput.organisationId,
      );

      return res.status(200).json(toCatalogResolveOperationResponseDTO(result));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Parameters.")) {
        return res.status(400).json({
          message: error.message,
        });
      }

      return handleError(
        res,
        error,
        "Unable to resolve healthcare service operation.",
      );
    }
  },

  searchCatalogOperation: async (req: Request, res: Response) => {
    try {
      const parsed = parametersOperationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid FHIR Parameters payload.",
          errors: parsed.error.flatten(),
        });
      }

      const operationInput = fromCatalogSearchOperationRequestDTO(parsed.data);

      const result = await CatalogService.searchItems({
        organisationId: operationInput.organisationId,
        q: operationInput.q,
        specialityId: operationInput.specialityId,
        kinds: operationInput.kinds,
        includeArchived: operationInput.includeArchived,
        excludePackageId: operationInput.excludePackageId,
        includeNestedBreakdown: operationInput.includeNestedBreakdown,
        page: operationInput.page,
        pageSize: operationInput.pageSize,
      });

      return res.status(200).json(toCatalogSearchOperationResponseDTO(result));
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message === "Parameters.organization is required." ||
          error.message.startsWith("Unsupported catalog search kind:")
        ) {
          return res.status(400).json({
            message: error.message,
          });
        }
      }

      return handleError(
        res,
        error,
        "Unable to execute healthcare service search operation.",
      );
    }
  },

  getOrganisationSummary: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = summaryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid organisation catalog summary query.",
          errors: parsed.error.flatten(),
        });
      }

      const result = await CatalogService.getOrganisationSummary(
        req.params.organisationId,
        {
          search: parsed.data.search,
          includeArchived: parsed.data.includeArchived === "true",
        },
      );

      return res.status(200).json(result);
    } catch (error) {
      return handleError(
        res,
        error,
        "Unable to fetch organisation catalog summary.",
      );
    }
  },

  listSpecialities: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = specialitiesListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid specialities list query.",
          errors: parsed.error.flatten(),
        });
      }

      const result = await CatalogService.listSpecialities(
        req.params.organisationId,
        parsed.data,
      );
      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error, "Unable to list catalog specialities.");
    }
  },

  createSpeciality: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = specialityMutationSchema.safeParse(req.body);
      if (!parsed.success || !parsed.data.name) {
        return res.status(400).json({
          message: "Invalid speciality payload.",
          errors: parsed.success
            ? { fieldErrors: { name: ["Name is required."] } }
            : parsed.error.flatten(),
        });
      }

      const created = await CatalogService.createSpeciality({
        organisationId: req.params.organisationId,
        name: parsed.data.name,
        headUserId: parsed.data.headUserId,
        headName: parsed.data.headName,
        headProfilePicUrl: parsed.data.headProfilePicUrl,
        teamMemberIds: parsed.data.teamMemberIds,
      });

      return res.status(201).json(created);
    } catch (error) {
      return handleError(res, error, "Unable to create catalog speciality.");
    }
  },

  updateSpeciality: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = specialityMutationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid speciality payload.",
          errors: parsed.error.flatten(),
        });
      }

      const updated = await CatalogService.updateSpeciality(
        req.params.specialityId,
        {
          organisationId: req.params.organisationId,
          name: parsed.data.name,
          headUserId: parsed.data.headUserId,
          headName: parsed.data.headName,
          headProfilePicUrl: parsed.data.headProfilePicUrl,
          teamMemberIds: parsed.data.teamMemberIds,
        },
      );

      return res.status(200).json(updated);
    } catch (error) {
      return handleError(res, error, "Unable to update catalog speciality.");
    }
  },

  archiveSpeciality: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      const updated = await CatalogService.archiveSpeciality(
        req.params.specialityId,
        req.params.organisationId,
      );
      return res.status(200).json(updated);
    } catch (error) {
      return handleError(res, error, "Unable to archive catalog speciality.");
    }
  },

  restoreSpeciality: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      const updated = await CatalogService.restoreSpeciality(
        req.params.specialityId,
        req.params.organisationId,
      );
      return res.status(200).json(updated);
    } catch (error) {
      return handleError(res, error, "Unable to restore catalog speciality.");
    }
  },

  deleteSpeciality: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      await CatalogService.deleteSpeciality(
        req.params.specialityId,
        req.params.organisationId,
      );
      return res.status(204).json({});
    } catch (error) {
      return handleError(res, error, "Unable to delete catalog speciality.");
    }
  },

  listServicesBySpeciality: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = serviceListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid services list query.",
          errors: parsed.error.flatten(),
        });
      }

      const items = await CatalogService.listProducts({
        organisationId: req.params.organisationId,
        specialityId: req.params.specialityId,
        kinds: parsed.data.kind ? [parsed.data.kind] : undefined,
        includeInactive:
          parsed.data.status === "ALL" || parsed.data.status === "ARCHIVED",
        search: parsed.data.search,
        supportsInpatient:
          parsed.data.supportsInpatient === "true"
            ? true
            : parsed.data.supportsInpatient === "false"
              ? false
              : undefined,
      });

      return res.status(200).json({
        items: items.filter((item) => {
          if (item.kind === "PACKAGE") return false;
          if (parsed.data.status === "ACTIVE") return item.isActive;
          if (parsed.data.status === "ARCHIVED") return !item.isActive;
          if (parsed.data.isBookable === "true") return Boolean(item.bookable);
          if (parsed.data.isBookable === "false") return !item.bookable;
          return true;
        }),
      });
    } catch (error) {
      return handleError(res, error, "Unable to list speciality services.");
    }
  },

  createService: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = serviceMutationSchema.safeParse(req.body);
      if (!parsed.success || !parsed.data.name || !parsed.data.kind) {
        return res.status(400).json({
          message: "Invalid service payload.",
          errors: parsed.success
            ? {
                fieldErrors: {
                  ...(parsed.data.name ? {} : { name: ["Name is required."] }),
                  ...(parsed.data.kind ? {} : { kind: ["Kind is required."] }),
                },
              }
            : parsed.error.flatten(),
        });
      }

      const created = await CatalogService.createProduct(
        toServiceUpsertInput({
          organisationId: req.params.organisationId,
          specialityId: req.params.specialityId,
          payload: parsed.data,
        }),
      );
      return res.status(201).json(created);
    } catch (error) {
      return handleError(res, error, "Unable to create service.");
    }
  },

  updateService: async (
    req: Request<{ organisationId: string; id: string }>,
    res: Response,
  ) => {
    try {
      const parsed = serviceMutationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid service payload.",
          errors: parsed.error.flatten(),
        });
      }

      const expectedVersion = parseIfMatchVersion(req);
      const updated = await CatalogService.updateProduct(req.params.id, {
        ...toServiceUpsertInput({
          organisationId: req.params.organisationId,
          payload: parsed.data,
        }),
        expectedVersion,
      });
      setVersionHeader(res, updated.version);
      return res.status(200).json(updated);
    } catch (error) {
      return handleError(res, error, "Unable to update service.");
    }
  },

  archiveService: async (
    req: Request<{ organisationId: string; id: string }>,
    res: Response,
  ) => {
    try {
      const updated = await CatalogService.archiveProduct(
        req.params.id,
        req.params.organisationId,
        parseIfMatchVersion(req),
      );
      setVersionHeader(res, updated.version);
      return res.status(200).json(updated);
    } catch (error) {
      return handleError(res, error, "Unable to archive service.");
    }
  },

  restoreService: async (
    req: Request<{ organisationId: string; id: string }>,
    res: Response,
  ) => {
    try {
      const updated = await CatalogService.restoreProduct(
        req.params.id,
        req.params.organisationId,
        parseIfMatchVersion(req),
      );
      setVersionHeader(res, updated.version);
      return res.status(200).json(updated);
    } catch (error) {
      return handleError(res, error, "Unable to restore service.");
    }
  },

  deleteService: async (
    req: Request<{ organisationId: string; id: string }>,
    res: Response,
  ) => {
    try {
      await CatalogService.deleteProduct(
        req.params.id,
        req.params.organisationId,
        parseIfMatchVersion(req),
      );
      return res.status(204).json({});
    } catch (error) {
      return handleError(res, error, "Unable to delete service.");
    }
  },

  listPackagesBySpeciality: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = packageListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid packages list query.",
          errors: parsed.error.flatten(),
        });
      }

      const items = await CatalogService.listProducts({
        organisationId: req.params.organisationId,
        specialityId: req.params.specialityId,
        kinds: ["PACKAGE"],
        includeInactive:
          parsed.data.status === "ALL" || parsed.data.status === "ARCHIVED",
        search: parsed.data.search,
        supportsInpatient:
          parsed.data.supportsInpatient === "true"
            ? true
            : parsed.data.supportsInpatient === "false"
              ? false
              : undefined,
      });

      return res.status(200).json({
        items: items.filter((item) => {
          if (parsed.data.status === "ACTIVE") return item.isActive;
          if (parsed.data.status === "ARCHIVED") return !item.isActive;
          return true;
        }),
      });
    } catch (error) {
      return handleError(res, error, "Unable to list speciality packages.");
    }
  },

  createPackage: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = packageMutationSchema.safeParse(req.body);
      if (!parsed.success || !parsed.data.name) {
        return res.status(400).json({
          message: "Invalid package payload.",
          errors: parsed.success
            ? { fieldErrors: { name: ["Name is required."] } }
            : parsed.error.flatten(),
        });
      }

      const created = await CatalogService.createProduct(
        toPackageUpsertInput({
          organisationId: req.params.organisationId,
          specialityId: req.params.specialityId,
          payload: parsed.data,
        }),
      );
      setVersionHeader(res, created.version);
      return res.status(201).json(created);
    } catch (error) {
      return handleError(res, error, "Unable to create package.");
    }
  },

  updatePackage: async (
    req: Request<{ organisationId: string; id: string }>,
    res: Response,
  ) => {
    try {
      const parsed = packageMutationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid package payload.",
          errors: parsed.error.flatten(),
        });
      }

      const expectedVersion = parseIfMatchVersion(req);
      const updated = await CatalogService.updateProduct(req.params.id, {
        ...toPackageUpsertInput({
          organisationId: req.params.organisationId,
          payload: parsed.data,
        }),
        expectedVersion,
      });
      setVersionHeader(res, updated.version);
      return res.status(200).json(updated);
    } catch (error) {
      return handleError(res, error, "Unable to update package.");
    }
  },

  archivePackage: async (
    req: Request<{ organisationId: string; id: string }>,
    res: Response,
  ) => {
    try {
      const updated = await CatalogService.archiveProduct(
        req.params.id,
        req.params.organisationId,
        parseIfMatchVersion(req),
      );
      setVersionHeader(res, updated.version);
      return res.status(200).json(updated);
    } catch (error) {
      return handleError(res, error, "Unable to archive package.");
    }
  },

  restorePackage: async (
    req: Request<{ organisationId: string; id: string }>,
    res: Response,
  ) => {
    try {
      const updated = await CatalogService.restoreProduct(
        req.params.id,
        req.params.organisationId,
        parseIfMatchVersion(req),
      );
      setVersionHeader(res, updated.version);
      return res.status(200).json(updated);
    } catch (error) {
      return handleError(res, error, "Unable to restore package.");
    }
  },

  deletePackage: async (
    req: Request<{ organisationId: string; id: string }>,
    res: Response,
  ) => {
    try {
      await CatalogService.deleteProduct(
        req.params.id,
        req.params.organisationId,
        parseIfMatchVersion(req),
      );
      return res.status(204).json({});
    } catch (error) {
      return handleError(res, error, "Unable to delete package.");
    }
  },

  searchItems: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = itemSearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid catalog search query.",
          errors: parsed.error.flatten(),
        });
      }

      const kinds = parsed.data.kinds
        ?.split(",")
        .map((kind) => kind.trim())
        .filter(Boolean) as
        | Array<
            | "CONSULTATION"
            | "PROCEDURE"
            | "LAB"
            | "MEDICATION"
            | "INVENTORY"
            | "PACKAGE"
          >
        | undefined;

      const result = await CatalogService.searchItems({
        organisationId: req.params.organisationId,
        q: parsed.data.q,
        specialityId: parsed.data.specialityId,
        kinds,
        includeArchived: parsed.data.includeArchived === "true",
        excludePackageId: parsed.data.excludePackageId,
        includeNestedBreakdown: parsed.data.includeNestedBreakdown === "true",
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      });

      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error, "Unable to search catalog items.");
    }
  },

  getArchiveCatalog: async (
    req: Request<{ organisationId: string; specialityId: string }>,
    res: Response,
  ) => {
    try {
      const search =
        typeof req.query.search === "string" ? req.query.search : undefined;
      const result = await CatalogService.getArchiveCatalog(
        req.params.organisationId,
        req.params.specialityId,
        search,
      );
      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error, "Unable to fetch archived catalog items.");
    }
  },

  getCatalogNearbyOrganisations: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = catalogNearbySearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid catalog nearby search query.",
          errors: parsed.error.flatten(),
        });
      }

      const result =
        await CatalogService.listOrganisationsProvidingServiceNearby(
          parsed.data.lat,
          parsed.data.lng,
          parsed.data.radius ?? 5000,
        );

      return res.status(200).json(result);
    } catch (error) {
      return handleError(
        res,
        error,
        "Unable to fetch nearby catalog organisations.",
      );
    }
  },

  getCatalogBookableSlots: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = catalogBookableSlotsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid catalog bookable slots payload.",
          errors: parsed.error.flatten(),
        });
      }

      const productItemId = parsed.data.productItemId ?? parsed.data.serviceId;
      if (!productItemId) {
        return res.status(400).json({
          message: "productItemId is required.",
        });
      }

      const result = await CatalogService.getBookableSlotsService(
        productItemId,
        req.params.organisationId,
        dayjs.utc(parsed.data.date, "YYYY-MM-DD", true).toDate(),
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(res, error, "Unable to fetch catalog bookable slots.");
    }
  },

  getCatalogCalendarPrefill: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ) => {
    try {
      const parsed = catalogCalendarPrefillSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid catalog calendar prefill payload.",
          errors: parsed.error.flatten(),
        });
      }

      const serviceIds = parsed.data.productItemIds ?? parsed.data.serviceIds;
      if (!serviceIds?.length) {
        return res.status(400).json({
          message: "productItemIds is required.",
        });
      }

      const matches = await CatalogService.getCalendarPrefillMatches({
        organisationId: parsed.data.organisationId,
        date: dayjs.utc(parsed.data.date, "YYYY-MM-DD", true).toDate(),
        minuteOfDay: parsed.data.minuteOfDay,
        leadId: parsed.data.leadId,
        serviceIds,
      });

      return res.status(200).json({
        success: true,
        data: { matches },
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Unable to fetch catalog calendar prefill.",
      );
    }
  },
};
