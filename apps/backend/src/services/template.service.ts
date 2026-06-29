import {
  Prisma,
  TemplateInstanceStatus,
  TemplateKind,
  TemplateOwnershipType,
  TemplateScope,
  TemplateStatus,
} from "@prisma/client";
import type {
  TemplateAppliesTo,
  TemplateContractKind,
  TemplateResolveInput,
  TemplateResolveResponse,
  TemplateSource,
} from "@yosemite-crew/types";
import { normalizeTemplateKind } from "@yosemite-crew/types";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import { validateClinicalTemplateBlueprint } from "src/services/clinical-template-blueprints";
import {
  createRenderedDocumentRecord,
  type PersistRenderedDocumentInput,
} from "src/services/rendered-document.service";
import { validateTaskWorkflowTemplateBlueprint } from "src/services/task-workflow-blueprints";
import { TaskWorkflowService } from "src/services/task-workflow.service";

export class TemplateServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "TemplateServiceError";
  }
}

const templateFieldSourceSchema = z.enum(["USER", "SYSTEM", "TASK", "FHIR"]);

const templateFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "select",
  "multiSelect",
  "boolean",
  "signature",
  "table",
  "repeater",
  "observation",
  "vitalRow",
  "medicationLine",
  "diagnosis",
  "procedure",
  "instructionBlock",
  "assessmentItem",
  "planItem",
  "richText",
]);

export const templateFieldDefinitionSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: templateFieldTypeSchema,
  required: z.boolean().optional(),
  repeatable: z.boolean().optional(),
  section: z.string().trim().min(1).optional(),
  order: z.number().int().nonnegative().optional(),
  defaultValue: z.unknown().optional(),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        value: z.string().trim().min(1),
      }),
    )
    .optional(),
  rules: z.record(z.unknown()).optional(),
  visibilityConditions: z.record(z.unknown()).optional(),
  source: templateFieldSourceSchema.optional(),
});

export const templateSectionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  order: z.number().int().nonnegative().optional(),
  fields: z.array(templateFieldDefinitionSchema).default([]),
});

export const templateSchemaSnapshotSchema = z.object({
  sections: z.array(templateSectionSchema).default([]),
});

export const templateConfigSchema = z.record(z.unknown()).default({});

const templateContractKindSchema = z.enum([
  "SOAP_NOTE",
  "VITAL_RECORD",
  "DISCHARGE_SUMMARY",
  "PRESCRIPTION",
  "FORM",
  "CONSENT",
  "INPATIENT_SCHEDULE",
  "TASK_ASSIGNMENT",
]);

const templateStorageKindSchema = z.nativeEnum(TemplateKind);
const templateKindSchema = z.union([
  templateStorageKindSchema,
  templateContractKindSchema,
]);

export const createTemplateSchema = z
  .object({
    organisationId: z.string().trim().min(1).optional(),
    ownerUserId: z.string().trim().min(1).optional(),
    ownership: z.nativeEnum(TemplateOwnershipType).default("ORG_TEMPLATE"),
    kind: templateKindSchema,
    name: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    scope: z.nativeEnum(TemplateScope).default("ORGANISATION"),
    rules: z.record(z.unknown()).optional(),
    schemaSnapshot: templateSchemaSnapshotSchema,
    renderConfigSnapshot: templateConfigSchema.optional(),
    validationSnapshot: templateConfigSchema.optional(),
    createdBy: z.string().trim().min(1),
    updatedBy: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.ownership === "YC_LIBRARY") {
      if (value.organisationId !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["organisationId"],
          message: "YC library templates must not be bound to an organisation",
        });
      }

      if (value.ownerUserId !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ownerUserId"],
          message: "YC library templates must not be owned by a user",
        });
      }
    }

    if (
      value.ownership === "ORG_TEMPLATE" &&
      value.organisationId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organisationId"],
        message: "Organisation is required for organisation templates",
      });
    }

    if (value.ownership === "USER_TEMPLATE") {
      if (value.organisationId === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["organisationId"],
          message: "Organisation is required for user templates",
        });
      }

      if (value.ownerUserId === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ownerUserId"],
          message: "Owner user is required for user templates",
        });
      }
    }
  });

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).nullable().optional(),
  ownership: z.nativeEnum(TemplateOwnershipType).optional(),
  scope: z.nativeEnum(TemplateScope).optional(),
  status: z.nativeEnum(TemplateStatus).optional(),
  rules: z.record(z.unknown()).nullable().optional(),
  schemaSnapshot: templateSchemaSnapshotSchema.optional(),
  renderConfigSnapshot: templateConfigSchema.optional(),
  validationSnapshot: templateConfigSchema.optional(),
  updatedBy: z.string().trim().min(1).optional(),
});

export const createTemplateInstanceSchema = z.object({
  organisationId: z.string().trim().min(1),
  appointmentId: z.string().trim().min(1).optional(),
  caseId: z.string().trim().min(1).optional(),
  encounterId: z.string().trim().min(1).optional(),
  authorId: z.string().trim().min(1).optional(),
  data: z.record(z.unknown()).default({}),
});

export const updateTemplateInstanceSchema = z.object({
  data: z.record(z.unknown()).optional(),
  status: z.nativeEnum(TemplateInstanceStatus).optional(),
  signedBy: z.string().trim().min(1).optional().nullable(),
  signedAt: z.coerce.date().optional().nullable(),
  generatedPdfUrl: z.string().trim().min(1).optional().nullable(),
  generatedPdf: z.record(z.unknown()).optional().nullable(),
});

export const updateTemplateCatalogLinksSchema = z.object({
  catalogItemIds: z.array(z.string().trim().min(1)).default([]),
});

export const resolveTemplateSchema = z.object({
  organisationId: z.string().trim().min(1),
  kind: templateContractKindSchema,
  appointmentId: z.string().trim().min(1).optional(),
  encounterId: z.string().trim().min(1).optional(),
  companionId: z.string().trim().min(1).optional(),
  species: z.string().trim().min(1).optional(),
  serviceId: z.string().trim().min(1).optional(),
  packageId: z.string().trim().min(1).optional(),
  mode: z.enum(["OUTPATIENT", "INPATIENT"]).optional(),
  ownerUserId: z.string().trim().min(1).optional(),
});

type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
type CreateTemplateInstanceInput = z.infer<typeof createTemplateInstanceSchema>;
type UpdateTemplateInstanceInput = z.infer<typeof updateTemplateInstanceSchema>;
type UpdateTemplateCatalogLinksInput = z.infer<
  typeof updateTemplateCatalogLinksSchema
>;
type ResolveTemplateInput = z.infer<typeof resolveTemplateSchema>;

const ensureId = (value: string, field: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TemplateServiceError(`Invalid ${field}`, 400);
  }
  return trimmed;
};

const mergeJsonObject = (
  base: Prisma.JsonValue | null | undefined,
  patch: Record<string, unknown> | null | undefined,
): Record<string, unknown> => ({
  ...(typeof base === "object" && base && !Array.isArray(base)
    ? (base as Record<string, unknown>)
    : {}),
  ...(patch ?? {}),
});

const toJsonInput = (
  value: unknown,
  fallback: Record<string, unknown> = {},
): Prisma.InputJsonValue => {
  return (value ?? fallback) as Prisma.InputJsonValue;
};

const toNullableJsonInput = (
  value: unknown,
):
  | Prisma.InputJsonValue
  | Prisma.NullTypes.DbNull
  | Prisma.NullTypes.JsonNull
  | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.DbNull;
  }

  return value as Prisma.InputJsonValue;
};

const buildRenderedDocumentSummary = (
  renderedDocument: Awaited<ReturnType<typeof createRenderedDocumentRecord>>,
) => ({
  renderedDocumentId: renderedDocument.id,
  sourceKind: renderedDocument.sourceKind,
  sourceId: renderedDocument.sourceId,
  kind: renderedDocument.kind,
  version: renderedDocument.version,
  status: renderedDocument.status,
  signable: renderedDocument.signable,
  mimeType: renderedDocument.mimeType,
  signedAt: renderedDocument.signedAt ?? null,
  signedBy: renderedDocument.signedBy ?? null,
});

const DOCUMENT_BACKED_TEMPLATE_KINDS = new Set<TemplateKind>([
  "FORM",
  "SOAP_NOTE",
  "PRESCRIPTION",
  "DISCHARGE_SUMMARY",
  "VITAL_RECORD",
]);

const resolveVersionPayload = (template: {
  latestVersion: number;
  publishedVersion: number | null;
}) => ({
  createNewVersion:
    template.publishedVersion != null &&
    template.publishedVersion === template.latestVersion,
  targetVersion: template.latestVersion,
});

const templateInclude = {
  versions: {
    orderBy: { version: "desc" as const },
  },
  catalogLinks: {
    select: {
      catalogItemId: true,
    },
  },
};

const withCatalogItemIds = <
  T extends {
    catalogLinks?: Array<{ catalogItemId: string }>;
    ownership: TemplateOwnershipType;
    rules: unknown;
    kind: TemplateKind;
  },
>(
  template: T,
) => ({
  ...template,
  kind: normalizeTemplateKind(template.kind),
  catalogItemIds:
    template.catalogLinks?.map((link) => link.catalogItemId) ?? [],
  source: templateSourceFromOwnership(template.ownership),
  appliesTo: extractTemplateAppliesTo(template.rules),
});

const templateSourceFromOwnership = (
  ownership: TemplateOwnershipType,
): TemplateSource => {
  switch (ownership) {
    case "YC_LIBRARY":
      return "YC_LIBRARY";
    case "USER_TEMPLATE":
      return "USER";
    case "ORG_TEMPLATE":
    default:
      return "ORGANISATION";
  }
};

const toStorageTemplateKind = (kind: TemplateContractKind | TemplateKind) => {
  switch (kind) {
    case "TASK_ASSIGNMENT":
      return "TASK_TEMPLATE" as TemplateKind;
    case "INPATIENT_SCHEDULE":
      return "CARE_PATHWAY" as TemplateKind;
    case "CONSENT":
      return "FORM" as TemplateKind;
    default:
      return kind as TemplateKind;
  }
};

const normalizeResolverText = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : undefined;

const normalizeResolverArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => normalizeResolverText(entry))
    .filter((entry): entry is string => Boolean(entry));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
};

const extractTemplateAppliesTo = (rules: unknown): TemplateAppliesTo | null => {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
    return null;
  }

  const root = rules as Record<string, unknown>;
  const raw =
    root.appliesTo &&
    typeof root.appliesTo === "object" &&
    !Array.isArray(root.appliesTo)
      ? (root.appliesTo as Record<string, unknown>)
      : root;

  const serviceIds = normalizeResolverArray(raw.serviceIds);
  const packageIds = normalizeResolverArray(raw.packageIds);
  const species = normalizeResolverArray(raw.species);
  const encounterModes = normalizeResolverArray(raw.encounterModes) as
    | Array<"OUTPATIENT" | "INPATIENT">
    | undefined;
  const organisationTypes = normalizeResolverArray(raw.organisationTypes);
  const specialityIds = normalizeResolverArray(raw.specialityIds);
  const defaultForKind =
    typeof raw.defaultForKind === "boolean" ? raw.defaultForKind : undefined;

  if (
    !serviceIds &&
    !packageIds &&
    !species &&
    !encounterModes &&
    !organisationTypes &&
    !specialityIds &&
    defaultForKind === undefined
  ) {
    return null;
  }

  return {
    serviceIds,
    packageIds,
    species,
    encounterModes,
    organisationTypes,
    specialityIds,
    defaultForKind,
  };
};

const extractLegacyCatalogItemIds = (template: {
  catalogItemIds?: string[];
  appliesTo?: TemplateAppliesTo | null;
}) => {
  const legacyIds = template.catalogItemIds?.filter(Boolean) ?? [];
  if (legacyIds.length > 0) {
    return legacyIds;
  }

  const serviceIds = template.appliesTo?.serviceIds ?? [];
  const packageIds = template.appliesTo?.packageIds ?? [];
  return Array.from(new Set([...serviceIds, ...packageIds]));
};

const applyTemplateMetadata = <
  T extends { ownership: TemplateOwnershipType; rules: unknown } & {
    catalogItemIds?: string[];
  },
>(
  template: T,
) => ({
  ...template,
  source: templateSourceFromOwnership(template.ownership),
  appliesTo:
    extractTemplateAppliesTo(template.rules) ??
    (extractLegacyCatalogItemIds(template).length > 0
      ? {
          serviceIds: extractLegacyCatalogItemIds(template),
        }
      : null),
});

const normalizeResolverMode = (value?: string) =>
  value === "INPATIENT" || value === "OUTPATIENT" ? value : undefined;

const resolveTemplateModeFromContext = async (
  input: TemplateResolveInput,
): Promise<"INPATIENT" | "OUTPATIENT" | undefined> => {
  if (input.mode) {
    return input.mode;
  }

  const contextClauses: Prisma.AppointmentWhereInput[] = [];
  if (input.appointmentId) {
    contextClauses.push({ id: input.appointmentId });
  }
  if (input.encounterId) {
    contextClauses.push({ encounterId: input.encounterId });
  }

  if (contextClauses.length === 0) {
    return undefined;
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      OR: contextClauses,
    },
    select: {
      appointmentKind: true,
      encounterId: true,
    },
  });

  if (appointment?.appointmentKind === "INPATIENT") {
    return "INPATIENT";
  }

  const encounterId = appointment?.encounterId ?? input.encounterId;
  if (!encounterId) {
    return undefined;
  }

  const admission = await prisma.admission.findUnique({
    where: { encounterId },
    select: { admittedAt: true },
  });

  return admission ? "INPATIENT" : "OUTPATIENT";
};

const normalizeResolverKind = (kind: TemplateContractKind): TemplateKind[] => {
  switch (kind) {
    case "CONSENT":
      return ["FORM"];
    case "TASK_ASSIGNMENT":
      return ["TASK_TEMPLATE"];
    case "INPATIENT_SCHEDULE":
      return ["CARE_PATHWAY"];
    default:
      return [kind];
  }
};

const templateMatchesResolverInput = (
  template: {
    ownership: TemplateOwnershipType;
    ownerUserId: string | null;
    rules: unknown;
    catalogItemIds?: string[];
  } & { appliesTo?: TemplateAppliesTo | null },
  input: TemplateResolveInput,
) => {
  const appliesTo =
    template.appliesTo ?? extractTemplateAppliesTo(template.rules);
  const catalogItemIds = extractLegacyCatalogItemIds(template);
  const queryServiceId = normalizeResolverText(input.serviceId);
  const queryPackageId = normalizeResolverText(input.packageId);
  const querySpecies = normalizeResolverText(input.species);
  const queryMode = normalizeResolverMode(input.mode);

  const serviceMatches =
    queryServiceId !== undefined &&
    ((appliesTo?.serviceIds ?? []).some(
      (serviceId) => normalizeResolverText(serviceId) === queryServiceId,
    ) ||
      catalogItemIds.some(
        (catalogItemId) =>
          normalizeResolverText(catalogItemId) === queryServiceId,
      ));

  const packageMatches =
    queryPackageId !== undefined &&
    ((appliesTo?.packageIds ?? []).some(
      (packageId) => normalizeResolverText(packageId) === queryPackageId,
    ) ||
      catalogItemIds.some(
        (catalogItemId) =>
          normalizeResolverText(catalogItemId) === queryPackageId,
      ));

  const speciesMatches =
    querySpecies !== undefined &&
    (appliesTo?.species ?? []).some(
      (species) => normalizeResolverText(species) === querySpecies,
    );

  const modeMatches =
    queryMode !== undefined &&
    (appliesTo?.encounterModes ?? []).some(
      (mode) =>
        normalizeResolverText(mode) === normalizeResolverText(queryMode),
    );

  const linked =
    serviceMatches || packageMatches || speciesMatches || modeMatches;
  const defaultForKind = Boolean(appliesTo?.defaultForKind);
  const matchScore = [
    serviceMatches,
    packageMatches,
    speciesMatches,
    modeMatches,
  ].filter(Boolean).length;

  return {
    linked,
    defaultForKind,
    appliesTo,
    matchScore,
  };
};

const toResolveResponse = (
  template: NonNullable<Awaited<ReturnType<typeof prisma.template.findFirst>>>,
  version: {
    id: string;
    version: number;
    schemaSnapshot: unknown;
    renderConfigSnapshot: unknown;
    validationSnapshot: unknown;
  },
  input: TemplateResolveInput,
  reason: string,
): TemplateResolveResponse => ({
  templateId: template.id,
  templateVersion: version.version,
  templateVersionId: version.id,
  source: templateSourceFromOwnership(template.ownership),
  ownerUserId: template.ownerUserId ?? null,
  kind: input.kind,
  name: template.name,
  schemaSnapshot:
    (version.schemaSnapshot as TemplateResolveResponse["schemaSnapshot"]) ?? {
      sections: [],
    },
  renderConfigSnapshot:
    (version.renderConfigSnapshot as Record<string, unknown> | null) ?? null,
  validationSnapshot:
    (version.validationSnapshot as Record<string, unknown> | null) ?? null,
  appliesTo: applyTemplateMetadata(template).appliesTo,
  reason,
});

const assertTemplateOrganisation = (
  template: {
    organisationId: string | null;
    ownerUserId?: string | null;
    ownership: TemplateOwnershipType;
  },
  organisationId?: string,
  ownerUserId?: string,
) => {
  if (template.ownership === "YC_LIBRARY") {
    return;
  }

  if (template.ownership === "USER_TEMPLATE" && ownerUserId) {
    if (template.ownerUserId !== ownerUserId) {
      throw new TemplateServiceError("Template does not belong to user", 403);
    }
  }

  if (organisationId && template.organisationId !== organisationId) {
    throw new TemplateServiceError(
      "Template does not belong to organisation",
      403,
    );
  }
};

const loadTemplateOrThrow = async (
  templateId: string,
  organisationId?: string,
) => {
  const template = await prisma.template.findUnique({
    where: { id: ensureId(templateId, "templateId") },
  });

  if (!template) {
    throw new TemplateServiceError("Template not found", 404);
  }

  assertTemplateOrganisation(template, organisationId);

  return template;
};

const loadTemplateVersionOrThrow = async (
  templateId: string,
  version: number,
) => {
  const templateVersion = await prisma.templateVersion.findUnique({
    where: { templateId_version: { templateId, version } },
  });

  if (!templateVersion) {
    throw new TemplateServiceError("Template version not found", 404);
  }

  return templateVersion;
};

const validateTemplateSchemaForKind = (
  kind: TemplateKind,
  schemaSnapshot: unknown,
) => {
  const validation =
    kind === "TASK_TEMPLATE" || kind === "CARE_PATHWAY"
      ? validateTaskWorkflowTemplateBlueprint(kind, schemaSnapshot)
      : validateClinicalTemplateBlueprint(kind, schemaSnapshot);

  const { missingSectionIds, missingFieldPaths, invalidFieldPaths } =
    validation;

  if (
    missingSectionIds.length > 0 ||
    missingFieldPaths.length > 0 ||
    invalidFieldPaths.length > 0
  ) {
    const issues = [
      missingSectionIds.length > 0
        ? `missing sections: ${missingSectionIds.join(", ")}`
        : null,
      missingFieldPaths.length > 0
        ? `missing fields: ${missingFieldPaths.join(", ")}`
        : null,
      invalidFieldPaths.length > 0
        ? `invalid fields: ${invalidFieldPaths.join(", ")}`
        : null,
    ]
      .filter((issue): issue is string => issue !== null)
      .join("; ");

    throw new TemplateServiceError(
      `Template schema is invalid for ${kind}: ${issues}`,
      400,
    );
  }
};

const resolveTemplateVersion = async (template: {
  id: string;
  latestVersion: number;
  publishedVersion: number | null;
}) => {
  const versionNumber = template.publishedVersion ?? template.latestVersion;
  const version = await loadTemplateVersionOrThrow(template.id, versionNumber);
  return version;
};

const resolveCandidateReason = (
  bucket:
    | "USER_LINKED"
    | "ORG_LINKED"
    | "USER_DEFAULT"
    | "ORG_DEFAULT"
    | "YC_DEFAULT",
  matched: ReturnType<typeof templateMatchesResolverInput>,
) => {
  const linkReason = matched.linked ? "linked" : "default";
  switch (bucket) {
    case "USER_LINKED":
      return matched.appliesTo?.defaultForKind
        ? "Matched user template default for kind."
        : "Matched user template linked to service/species/mode.";
    case "ORG_LINKED":
      return matched.appliesTo?.defaultForKind
        ? "Matched organisation template default for kind."
        : "Matched organisation template linked to service/species/mode.";
    case "USER_DEFAULT":
      return `Matched user default template for kind (${linkReason}).`;
    case "ORG_DEFAULT":
      return `Matched organisation default template for kind (${linkReason}).`;
    case "YC_DEFAULT":
    default:
      return `Matched YC library default template for kind (${linkReason}).`;
  }
};

const compareResolverMatches = (
  left: ReturnType<typeof templateMatchesResolverInput> & { score: number },
  right: ReturnType<typeof templateMatchesResolverInput> & { score: number },
) => {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.matchScore !== left.matchScore) {
    return right.matchScore - left.matchScore;
  }

  if (right.linked !== left.linked) {
    return Number(right.linked) - Number(left.linked);
  }

  return Number(right.defaultForKind) - Number(left.defaultForKind);
};

export const TemplateService = {
  async create(input: CreateTemplateInput) {
    const parsed = createTemplateSchema.parse(input);
    const updatedBy = parsed.updatedBy ?? parsed.createdBy;
    const storageKind = toStorageTemplateKind(parsed.kind);
    validateTemplateSchemaForKind(storageKind, parsed.schemaSnapshot);
    const organisationId =
      parsed.ownership === "YC_LIBRARY" ? undefined : parsed.organisationId;
    const ownerUserId =
      parsed.ownership === "USER_TEMPLATE" ? parsed.ownerUserId : undefined;

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          organisationId,
          ownerUserId,
          ownership: parsed.ownership,
          kind: storageKind,
          name: parsed.name,
          description: parsed.description ?? undefined,
          status: "DRAFT",
          scope: parsed.scope,
          rules: toNullableJsonInput(parsed.rules),
          latestVersion: 1,
          publishedVersion: null,
          createdBy: parsed.createdBy,
          updatedBy,
        },
      });

      await tx.templateVersion.create({
        data: {
          templateId: created.id,
          version: 1,
          schemaSnapshot: toJsonInput(parsed.schemaSnapshot),
          renderConfigSnapshot: toJsonInput(parsed.renderConfigSnapshot),
          validationSnapshot: toJsonInput(parsed.validationSnapshot),
          createdBy: parsed.createdBy,
        },
      });

      return created;
    });

    return TemplateService.getById(template.id);
  },

  async update(
    templateId: string,
    input: UpdateTemplateInput,
    organisationId?: string,
  ) {
    const parsed = updateTemplateSchema.parse(input);
    const template = await loadTemplateOrThrow(templateId, organisationId);
    const { createNewVersion, targetVersion } = resolveVersionPayload(template);

    const nextOwnership = parsed.ownership ?? template.ownership;
    const nextOrganisationId =
      nextOwnership === "YC_LIBRARY" ? null : template.organisationId;
    const nextOwnerUserId =
      nextOwnership === "YC_LIBRARY" ? null : template.ownerUserId;
    const nextUpdatedBy = parsed.updatedBy ?? template.updatedBy;
    const nextName = parsed.name ?? template.name;
    const nextDescription =
      parsed.description === undefined
        ? template.description
        : (parsed.description ?? undefined);
    const nextScope = parsed.scope ?? template.scope;
    const nextStatus = parsed.status ?? template.status;
    const nextRules =
      parsed.rules === undefined ? template.rules : (parsed.rules ?? null);
    const hasVersionChanges =
      parsed.schemaSnapshot !== undefined ||
      parsed.renderConfigSnapshot !== undefined ||
      parsed.validationSnapshot !== undefined;
    const currentVersion = hasVersionChanges
      ? await loadTemplateVersionOrThrow(template.id, targetVersion)
      : null;
    const nextSchemaSnapshot =
      parsed.schemaSnapshot === undefined
        ? currentVersion?.schemaSnapshot
        : parsed.schemaSnapshot;

    if (nextSchemaSnapshot != null) {
      validateTemplateSchemaForKind(template.kind, nextSchemaSnapshot);
    }

    if (createNewVersion && hasVersionChanges) {
      const nextVersion = template.latestVersion + 1;
      await prisma.$transaction(async (tx) => {
        await tx.template.update({
          where: { id: template.id },
          data: {
            ownership: nextOwnership,
            organisationId: nextOrganisationId,
            ownerUserId: nextOwnerUserId,
            name: nextName,
            description: nextDescription,
            scope: nextScope,
            status: nextStatus,
            rules: toNullableJsonInput(nextRules),
            latestVersion: nextVersion,
            updatedBy: nextUpdatedBy,
          },
        });

        await tx.templateVersion.create({
          data: {
            templateId: template.id,
            version: nextVersion,
            schemaSnapshot: toJsonInput(
              nextSchemaSnapshot ?? currentVersion?.schemaSnapshot,
            ),
            renderConfigSnapshot: toJsonInput(
              parsed.renderConfigSnapshot ??
                currentVersion?.renderConfigSnapshot,
            ),
            validationSnapshot: toJsonInput(
              parsed.validationSnapshot ?? currentVersion?.validationSnapshot,
            ),
            createdBy: nextUpdatedBy,
          },
        });
      });

      return TemplateService.getById(template.id);
    }

    if (hasVersionChanges && currentVersion) {
      await prisma.templateVersion.update({
        where: { id: currentVersion.id },
        data: {
          schemaSnapshot: toJsonInput(
            parsed.schemaSnapshot === undefined
              ? currentVersion.schemaSnapshot
              : parsed.schemaSnapshot,
          ),
          renderConfigSnapshot: toJsonInput(
            parsed.renderConfigSnapshot === undefined
              ? currentVersion.renderConfigSnapshot
              : parsed.renderConfigSnapshot,
          ),
          validationSnapshot: toJsonInput(
            parsed.validationSnapshot === undefined
              ? currentVersion.validationSnapshot
              : parsed.validationSnapshot,
          ),
        },
      });
    }

    await prisma.template.update({
      where: { id: template.id },
      data: {
        ownership: nextOwnership,
        organisationId: nextOrganisationId,
        ownerUserId: nextOwnerUserId,
        name: nextName,
        description: nextDescription,
        scope: nextScope,
        status: nextStatus,
        rules: toNullableJsonInput(nextRules),
        updatedBy: nextUpdatedBy,
      },
    });

    return TemplateService.getById(template.id);
  },

  async publish(
    templateId: string,
    publishedBy: string,
    organisationId?: string,
  ) {
    const template = await loadTemplateOrThrow(templateId, organisationId);
    const latestVersion = await loadTemplateVersionOrThrow(
      template.id,
      template.latestVersion,
    );

    if (
      template.publishedVersion === template.latestVersion &&
      template.status === "PUBLISHED"
    ) {
      return TemplateService.getById(template.id);
    }

    await prisma.$transaction([
      prisma.template.update({
        where: { id: template.id },
        data: {
          status: "PUBLISHED",
          publishedVersion: template.latestVersion,
          updatedBy: ensureId(publishedBy, "publishedBy"),
        },
      }),
      prisma.templateVersion.update({
        where: { id: latestVersion.id },
        data: {
          publishedAt: new Date(),
        },
      }),
    ]);

    return TemplateService.getById(template.id);
  },

  async archive(
    templateId: string,
    archivedBy: string,
    organisationId?: string,
  ) {
    const template = await loadTemplateOrThrow(templateId, organisationId);

    await prisma.template.update({
      where: { id: template.id },
      data: {
        status: "ARCHIVED",
        updatedBy: ensureId(archivedBy, "archivedBy"),
      },
    });

    return TemplateService.getById(template.id);
  },

  async updateCatalogLinks(
    templateId: string,
    input: UpdateTemplateCatalogLinksInput,
    organisationId?: string,
  ) {
    const parsed = updateTemplateCatalogLinksSchema.parse(input);
    const template = await loadTemplateOrThrow(templateId, organisationId);

    if (template.ownership === "YC_LIBRARY") {
      throw new TemplateServiceError(
        "YC library templates cannot own catalog links.",
        400,
      );
    }

    const uniqueCatalogItemIds = Array.from(new Set(parsed.catalogItemIds));
    if (uniqueCatalogItemIds.length === 0) {
      await prisma.templateCatalogLink.deleteMany({
        where: { templateId: template.id },
      });
      return TemplateService.getById(template.id, organisationId);
    }

    const organisationFilter =
      template.organisationId != null
        ? { organisationId: template.organisationId }
        : {};
    const catalogItems = await prisma.productItem.findMany({
      where: {
        id: { in: uniqueCatalogItemIds },
        ...organisationFilter,
      },
      select: {
        id: true,
      },
    });

    if (catalogItems.length !== uniqueCatalogItemIds.length) {
      throw new TemplateServiceError(
        "One or more catalog items were not found for this organisation.",
        404,
      );
    }

    const existingLinks = await prisma.templateCatalogLink.findMany({
      where: {
        catalogItemId: { in: uniqueCatalogItemIds },
        templateId: { not: template.id },
      },
      select: {
        catalogItemId: true,
        template: {
          select: {
            kind: true,
          },
        },
      },
    });

    const conflicts = existingLinks.filter(
      (link) => link.template.kind === template.kind,
    );
    if (conflicts.length > 0) {
      throw new TemplateServiceError(
        "Each catalog item can only be linked to one template per kind.",
        400,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.templateCatalogLink.deleteMany({
        where: { templateId: template.id },
      });

      await tx.templateCatalogLink.createMany({
        data: uniqueCatalogItemIds.map((catalogItemId) => ({
          templateId: template.id,
          catalogItemId,
        })),
      });
    });

    return TemplateService.getById(template.id, organisationId);
  },

  async listForOrganisation(
    organisationId: string,
    filters?: {
      kind?: TemplateKind | TemplateContractKind;
      status?: TemplateStatus;
      scope?: TemplateScope;
      search?: string;
    },
  ) {
    const search = filters?.search?.trim();
    const items = await prisma.template.findMany({
      where: {
        organisationId: ensureId(organisationId, "organisationId"),
        ownership: "ORG_TEMPLATE",
        kind: filters?.kind ? toStorageTemplateKind(filters.kind) : undefined,
        status: filters?.status,
        scope: filters?.scope,
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      include: templateInclude,
    });

    return items.map(withCatalogItemIds);
  },

  async listLibrary(filters?: {
    kind?: TemplateKind | TemplateContractKind;
    status?: TemplateStatus;
    scope?: TemplateScope;
    search?: string;
  }) {
    const search = filters?.search?.trim();
    const items = await prisma.template.findMany({
      where: {
        ownership: "YC_LIBRARY",
        kind: filters?.kind ? toStorageTemplateKind(filters.kind) : undefined,
        status: filters?.status,
        scope: filters?.scope,
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      include: templateInclude,
    });

    return items.map(withCatalogItemIds);
  },

  async listForUser(
    organisationId: string,
    ownerUserId: string,
    filters?: {
      kind?: TemplateKind | TemplateContractKind;
      status?: TemplateStatus;
      scope?: TemplateScope;
      search?: string;
    },
  ) {
    const search = filters?.search?.trim();
    const items = await prisma.template.findMany({
      where: {
        organisationId: ensureId(organisationId, "organisationId"),
        ownerUserId: ensureId(ownerUserId, "ownerUserId"),
        ownership: "USER_TEMPLATE",
        kind: filters?.kind ? toStorageTemplateKind(filters.kind) : undefined,
        status: filters?.status,
        scope: filters?.scope,
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      include: templateInclude,
    });

    return items.map(withCatalogItemIds);
  },

  async getById(templateId: string, organisationId?: string) {
    const template = await prisma.template.findUnique({
      where: { id: ensureId(templateId, "templateId") },
      include: templateInclude,
    });

    if (!template) {
      throw new TemplateServiceError("Template not found", 404);
    }

    assertTemplateOrganisation(template, organisationId);

    return withCatalogItemIds(template);
  },

  async resolve(input: ResolveTemplateInput) {
    const parsed = resolveTemplateSchema.parse(input);
    const resolvedMode = await resolveTemplateModeFromContext(parsed);
    const matchingInput = {
      ...parsed,
      mode: resolvedMode ?? parsed.mode,
    };
    const prismaKinds = normalizeResolverKind(parsed.kind);
    const filters = {
      kind: prismaKinds[0],
      status: undefined as TemplateStatus | undefined,
      scope: undefined as TemplateScope | undefined,
    };

    const resolveFirstMatch = async (
      templates: Awaited<ReturnType<typeof TemplateService.listLibrary>>,
      bucket:
        | "USER_LINKED"
        | "ORG_LINKED"
        | "USER_DEFAULT"
        | "ORG_DEFAULT"
        | "YC_DEFAULT",
      requireLinked: boolean,
    ) => {
      const matches: Array<{
        template: (typeof templates)[number];
        matched: ReturnType<typeof templateMatchesResolverInput> & {
          score: number;
        };
      }> = [];

      for (const template of templates) {
        const matched = templateMatchesResolverInput(template, matchingInput);
        if (requireLinked ? matched.linked : matched.defaultForKind) {
          matches.push({
            template,
            matched: {
              ...matched,
              score:
                (requireLinked ? 100 : 0) +
                (matched.defaultForKind ? 10 : 0) +
                matched.matchScore,
            },
          });
        }
      }

      const bestMatch = matches.sort((left, right) =>
        compareResolverMatches(left.matched, right.matched),
      )[0];

      if (!bestMatch) {
        return null;
      }

      const version = await resolveTemplateVersion(bestMatch.template);
      return toResolveResponse(
        bestMatch.template as NonNullable<
          Awaited<ReturnType<typeof prisma.template.findFirst>>
        >,
        version,
        matchingInput,
        resolveCandidateReason(bucket, bestMatch.matched),
      );
    };

    if (parsed.ownerUserId) {
      const userTemplates = await TemplateService.listForUser(
        parsed.organisationId,
        parsed.ownerUserId,
        filters,
      );
      const userLinked = await resolveFirstMatch(
        userTemplates,
        "USER_LINKED",
        true,
      );
      if (userLinked) return userLinked;
    }

    const orgTemplates = await TemplateService.listForOrganisation(
      parsed.organisationId,
      filters,
    );
    const orgLinked = await resolveFirstMatch(orgTemplates, "ORG_LINKED", true);
    if (orgLinked) return orgLinked;

    if (parsed.ownerUserId) {
      const userTemplates = await TemplateService.listForUser(
        parsed.organisationId,
        parsed.ownerUserId,
        filters,
      );
      const userDefault = await resolveFirstMatch(
        userTemplates,
        "USER_DEFAULT",
        false,
      );
      if (userDefault) return userDefault;
    }

    const orgDefault = await resolveFirstMatch(
      orgTemplates,
      "ORG_DEFAULT",
      false,
    );
    if (orgDefault) return orgDefault;

    const libraryTemplates = await TemplateService.listLibrary(filters);
    const libraryDefault = await resolveFirstMatch(
      libraryTemplates,
      "YC_DEFAULT",
      false,
    );
    if (libraryDefault) return libraryDefault;

    throw new TemplateServiceError("Template not found", 404);
  },

  async createInstance(
    input: CreateTemplateInstanceInput & { templateId: string },
  ) {
    const parsed = createTemplateInstanceSchema.parse(input);
    const template = await loadTemplateOrThrow(
      input.templateId,
      parsed.organisationId,
    );
    const versionNumber = template.publishedVersion ?? template.latestVersion;
    const version = await loadTemplateVersionOrThrow(
      template.id,
      versionNumber,
    );

    return prisma.templateInstance.create({
      data: {
        templateId: template.id,
        templateVersion: version.version,
        organisationId: parsed.organisationId,
        appointmentId: parsed.appointmentId ?? undefined,
        caseId: parsed.caseId ?? undefined,
        encounterId: parsed.encounterId ?? undefined,
        status: "DRAFT",
        data: parsed.data as Prisma.InputJsonValue,
        authorId: parsed.authorId ?? undefined,
      },
    });
  },

  async updateInstance(
    instanceId: string,
    input: UpdateTemplateInstanceInput,
    organisationId?: string,
  ) {
    const parsed = updateTemplateInstanceSchema.parse(input);
    const instance = await prisma.templateInstance.findUnique({
      where: { id: ensureId(instanceId, "instanceId") },
    });

    if (!instance) {
      throw new TemplateServiceError("Template instance not found", 404);
    }

    if (organisationId && instance.organisationId !== organisationId) {
      throw new TemplateServiceError(
        "Template instance does not belong to organisation",
        403,
      );
    }

    return prisma.templateInstance.update({
      where: { id: instance.id },
      data: {
        data:
          parsed.data === undefined
            ? toJsonInput(instance.data)
            : toJsonInput(mergeJsonObject(instance.data, parsed.data)),
        status: parsed.status ?? instance.status,
        signedBy:
          parsed.signedBy === undefined
            ? instance.signedBy
            : (parsed.signedBy ?? undefined),
        signedAt:
          parsed.signedAt === undefined
            ? instance.signedAt
            : (parsed.signedAt ?? undefined),
        generatedPdfUrl:
          parsed.generatedPdfUrl === undefined
            ? instance.generatedPdfUrl
            : (parsed.generatedPdfUrl ?? undefined),
        generatedPdf:
          parsed.generatedPdf === undefined
            ? toNullableJsonInput(instance.generatedPdf)
            : toNullableJsonInput(parsed.generatedPdf),
      },
    });
  },

  async submitInstance(
    instanceId: string,
    organisationId?: string,
    submittedBy?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const instance = await tx.templateInstance.findUnique({
        where: { id: ensureId(instanceId, "instanceId") },
        include: {
          template: {
            select: {
              id: true,
              kind: true,
              ownership: true,
            },
          },
        },
      });

      if (!instance) {
        throw new TemplateServiceError("Template instance not found", 404);
      }

      if (organisationId && instance.organisationId !== organisationId) {
        throw new TemplateServiceError(
          "Template instance does not belong to organisation",
          403,
        );
      }

      if (instance.status === "COMPLETED") {
        return instance;
      }

      const createdBy = ensureId(
        submittedBy ?? instance.authorId ?? instance.signedBy ?? "",
        "submittedBy",
      );

      await TaskWorkflowService.launchFromTemplateInstance(
        instance.id,
        organisationId,
        createdBy,
        {
          client: tx,
          notify: true,
        },
      );

      let renderedDocumentSummary:
        | Awaited<ReturnType<typeof createRenderedDocumentRecord>>
        | undefined;

      if (DOCUMENT_BACKED_TEMPLATE_KINDS.has(instance.template.kind)) {
        const normalizedTemplateKind = normalizeTemplateKind(
          instance.template.kind,
        );
        const renderedDocumentInput: PersistRenderedDocumentInput = {
          title:
            normalizedTemplateKind === "FORM"
              ? "Form submission"
              : normalizedTemplateKind.replaceAll("_", " "),
          source: {
            sourceKind: "TEMPLATE_INSTANCE",
            sourceId: instance.id,
            organisationId: instance.organisationId,
            templateKind: normalizedTemplateKind,
            templateId: instance.templateId,
            templateVersion: instance.templateVersion,
          },
          templateInstanceId: instance.id,
        };

        renderedDocumentSummary = await createRenderedDocumentRecord(
          renderedDocumentInput,
          tx,
        );
      }

      return tx.templateInstance.update({
        where: { id: instance.id },
        data: {
          status: "COMPLETED",
          generatedPdf: renderedDocumentSummary
            ? buildRenderedDocumentSummary(renderedDocumentSummary)
            : toNullableJsonInput(instance.generatedPdf),
          generatedPdfUrl: renderedDocumentSummary?.pdfUrl ?? undefined,
        },
      });
    });
  },
};
