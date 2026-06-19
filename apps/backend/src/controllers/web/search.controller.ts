import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import {
  CatalogService,
  CatalogServiceError,
} from "src/services/catalog.service";
import {
  InventoryService,
  InventoryServiceError,
} from "src/services/inventory.service";
import { createFhirErrorHandler } from "src/controllers/web/fhir-controller.shared";
import type {
  ScopedSearchItem,
  ScopedSearchResponse,
} from "@yosemite-crew/types";

const searchQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  subCategory: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "HIDDEN", "DELETED"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const scopedSearchQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const asString = (value: unknown) => (typeof value === "string" ? value : null);

const toBatchSummary = (batch: Record<string, unknown>) => ({
  id: asString(batch.id) ?? "",
  batchNumber: asString(batch.batchNumber),
  lotNumber: asString(batch.lotNumber),
  expiryDate: batch.expiryDate instanceof Date ? batch.expiryDate : null,
  quantity: typeof batch.quantity === "number" ? batch.quantity : 0,
  allocated: typeof batch.allocated === "number" ? batch.allocated : 0,
});

const toSearchResult = (item: Record<string, unknown>) => ({
  itemId: asString(item.id) ?? "",
  organisationId: asString(item.organisationId) ?? "",
  name: asString(item.name) ?? "",
  code: asString(item.sku),
  genericName: asString(item.genericName),
  strength: asString(item.strength),
  dosageForm: asString(item.dosageForm),
  routeOfAdministration: asString(item.routeOfAdministration),
  drugClass: asString(item.drugClass),
  prescriptionRequired: Boolean(item.prescriptionRequired),
  controlledItem: Boolean(item.controlledItem),
  expiryTrackingRequired: Boolean(item.expiryTrackingRequired),
  unitOfMeasure: asString(item.unitOfMeasure),
  packageQuantity:
    typeof item.packageQuantity === "number" ? item.packageQuantity : null,
  onHand: typeof item.onHand === "number" ? item.onHand : 0,
  allocated: typeof item.allocated === "number" ? item.allocated : 0,
  nearestExpiryDate:
    item.nearestExpiryDate instanceof Date ? item.nearestExpiryDate : null,
  batches: Array.isArray(item.batches)
    ? item.batches.map((batch) =>
        toBatchSummary(batch as Record<string, unknown>),
      )
    : [],
});

const buildPagedResponse = (
  items: ScopedSearchItem[],
  query: string | null,
  page: number,
  pageSize: number,
): ScopedSearchResponse => {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    query,
    page,
    pageSize,
    total,
    items: items.slice(start, start + pageSize),
  };
};

const toScopedItem = (input: {
  id: string;
  scope: ScopedSearchItem["scope"];
  label: string;
  description?: string | null;
  kind?: string | null;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}): ScopedSearchItem => ({
  id: input.id,
  scope: input.scope,
  label: input.label,
  description: input.description ?? null,
  kind: input.kind ?? null,
  updatedAt: input.updatedAt,
  metadata: input.metadata,
});

const isMedicationItem = (item: Record<string, unknown>) =>
  item.itemType === "MEDICAL" ||
  Boolean(item.prescriptionRequired) ||
  asString(item.category)?.toLowerCase().includes("medication") === true;

const handleError = createFhirErrorHandler({
  isServiceError: (
    error,
  ): error is InventoryServiceError | CatalogServiceError =>
    error instanceof InventoryServiceError ||
    error instanceof CatalogServiceError,
  invalidPayloadMessage: "Invalid search query.",
  logMessage: "Unexpected search error",
});

const runSearch = async (
  organisationId: string,
  query: z.infer<typeof searchQuerySchema>,
  medicationOnly: boolean,
) => {
  const results = await InventoryService.listItems({
    organisationId,
    search: query.search,
    category: query.category,
    subCategory: query.subCategory,
    status: query.status ?? "ACTIVE",
    sortBy: "name",
  });

  const items = (Array.isArray(results) ? results : results.items)
    .map((item) => item as Record<string, unknown>)
    .filter((item) => (medicationOnly ? isMedicationItem(item) : true))
    .map(toSearchResult);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const total = items.length;
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
  };
};

const searchTemplates = async (
  organisationId: string,
  query: string | null,
) => {
  const templates = await prisma.template.findMany({
    where: {
      organisationId,
      ownership: { in: ["ORG_TEMPLATE", "USER_TEMPLATE"] },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return templates.map((template) =>
    toScopedItem({
      id: template.id,
      scope: "TEMPLATE",
      label: template.name,
      description: template.description,
      kind: template.kind,
      updatedAt: template.updatedAt,
      metadata: {
        ownership: template.ownership,
        status: template.status,
        scope: template.scope,
        latestVersion: template.latestVersion,
      },
    }),
  );
};

const searchTasks = async (organisationId: string, query: string | null) => {
  const tasks = await prisma.task.findMany({
    where: {
      organisationId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { additionalNotes: { contains: query, mode: "insensitive" } },
              { category: { contains: query, mode: "insensitive" } },
              { subcategory: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return tasks.map((task) =>
    toScopedItem({
      id: task.id,
      scope: "TASK",
      label: task.name,
      description: task.description ?? task.additionalNotes ?? null,
      kind: task.category,
      updatedAt: task.updatedAt,
      metadata: {
        status: task.status,
        audience: task.audience,
        source: task.source,
      },
    }),
  );
};

const searchDocuments = async (
  organisationId: string,
  query: string | null,
) => {
  const patientLinks = await prisma.patientOrganisation.findMany({
    where: {
      organisationId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: { patientId: true },
  });
  const patientIds = [...new Set(patientLinks.map((link) => link.patientId))];

  if (!patientIds.length) {
    return [];
  }

  const documents = await prisma.document.findMany({
    where: {
      patientId: { in: patientIds },
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { category: { contains: query, mode: "insensitive" } },
              { subcategory: { contains: query, mode: "insensitive" } },
              { visitType: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return documents.map((document) =>
    toScopedItem({
      id: document.id,
      scope: "DOCUMENT",
      label: document.title,
      description: document.category,
      kind: document.subcategory ?? document.visitType ?? null,
      updatedAt: document.updatedAt,
      metadata: {
        appointmentId: document.appointmentId,
        patientId: document.patientId,
        pmsVisible: document.pmsVisible,
      },
    }),
  );
};

const searchServices = async (organisationId: string, query: string | null) => {
  const result = await CatalogService.searchItems({
    organisationId,
    q: query ?? undefined,
    kinds: ["CONSULTATION", "PROCEDURE", "LAB"],
    includeArchived: false,
    page: 1,
    pageSize: 200,
  });

  return result.items
    .filter((item) => item.kind !== "PACKAGE")
    .map((item) =>
      toScopedItem({
        id: item.id,
        scope: "SERVICE",
        label: item.name,
        description: item.description,
        kind: item.kind,
        updatedAt: new Date(),
        metadata: {
          source: item.source,
          status: item.status,
          totalAmount: item.totalAmount,
          currency: item.currency,
        },
      }),
    );
};

const searchPackages = async (organisationId: string, query: string | null) => {
  const result = await CatalogService.searchItems({
    organisationId,
    q: query ?? undefined,
    kinds: ["PACKAGE"],
    includeArchived: false,
    page: 1,
    pageSize: 200,
  });

  return result.items.map((item) =>
    toScopedItem({
      id: item.id,
      scope: "PACKAGE",
      label: item.name,
      description: item.description,
      kind: item.kind,
      updatedAt: new Date(),
      metadata: {
        source: item.source,
        status: item.status,
        totalAmount: item.totalAmount,
        currency: item.currency,
      },
    }),
  );
};

export const SearchController = {
  async searchMedications(req: Request, res: Response) {
    try {
      const query = searchQuerySchema.parse(req.query);
      const result = await runSearch(req.params.organisationId, query, true);
      return res.status(200).json(result);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async searchInventoryItems(req: Request, res: Response) {
    try {
      const query = searchQuerySchema.parse(req.query);
      const result = await runSearch(req.params.organisationId, query, false);
      return res.status(200).json(result);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async searchTemplates(req: Request, res: Response) {
    try {
      const query = scopedSearchQuerySchema.parse(req.query);
      const items = await searchTemplates(
        req.params.organisationId,
        query.q ?? null,
      );
      return res
        .status(200)
        .json(
          buildPagedResponse(
            items,
            query.q ?? null,
            query.page ?? 1,
            query.pageSize ?? 25,
          ),
        );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async searchTasks(req: Request, res: Response) {
    try {
      const query = scopedSearchQuerySchema.parse(req.query);
      const items = await searchTasks(
        req.params.organisationId,
        query.q ?? null,
      );
      return res
        .status(200)
        .json(
          buildPagedResponse(
            items,
            query.q ?? null,
            query.page ?? 1,
            query.pageSize ?? 25,
          ),
        );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async searchDocuments(req: Request, res: Response) {
    try {
      const query = scopedSearchQuerySchema.parse(req.query);
      const items = await searchDocuments(
        req.params.organisationId,
        query.q ?? null,
      );
      return res
        .status(200)
        .json(
          buildPagedResponse(
            items,
            query.q ?? null,
            query.page ?? 1,
            query.pageSize ?? 25,
          ),
        );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async searchServices(req: Request, res: Response) {
    try {
      const query = scopedSearchQuerySchema.parse(req.query);
      const items = await searchServices(
        req.params.organisationId,
        query.q ?? null,
      );
      return res
        .status(200)
        .json(
          buildPagedResponse(
            items,
            query.q ?? null,
            query.page ?? 1,
            query.pageSize ?? 25,
          ),
        );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async searchPackages(req: Request, res: Response) {
    try {
      const query = scopedSearchQuerySchema.parse(req.query);
      const items = await searchPackages(
        req.params.organisationId,
        query.q ?? null,
      );
      return res
        .status(200)
        .json(
          buildPagedResponse(
            items,
            query.q ?? null,
            query.page ?? 1,
            query.pageSize ?? 25,
          ),
        );
    } catch (error) {
      return handleError(error, res);
    }
  },
};
