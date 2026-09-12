import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import {
  Form as FormType,
  FormField,
  toFHIRQuestionnaire,
} from "@yosemite-crew/types";
import { FormService, FormServiceError } from "./form.service";
import {
  parseSuppliedFormText,
  ParsedDraftField,
  UnsupportedConstruct,
} from "./formDraftImportParser";
import { computeFieldDiff, FieldDiffEntry } from "./formDraftImportDiff";

const ensureId = (id: string, label: string): string => {
  const trimmed = (id ?? "").trim();
  if (!trimmed) throw new FormServiceError(`Invalid ${label}`, 400);
  return trimmed;
};

const MAX_SUPPLIED_TEXT_LENGTH = 20_000;

const toFormFieldSchema = (fields: ParsedDraftField[]): FormField[] =>
  fields.map((field) => {
    if (
      field.type === "dropdown" ||
      field.type === "radio" ||
      field.type === "checkbox"
    ) {
      return {
        id: field.id,
        type: field.type,
        label: field.label,
        required: field.required,
        options: field.options ?? [],
      };
    }
    return {
      id: field.id,
      type: field.type,
      label: field.label,
      required: field.required,
    };
  });

const hasSignatureField = (fields: ParsedDraftField[]): boolean =>
  fields.some((field) => field.type === "signature");

interface SourceFormContext {
  id: string;
  name: string;
  category: string;
  updatedAt: Date;
  latestVersion: { version: number; fieldsSnapshot: FormField[] } | null;
}

const loadSourceForm = async (
  organisationId: string,
  sourceFormId: string,
): Promise<SourceFormContext> => {
  const form = await prisma.form.findFirst({
    where: { id: sourceFormId, orgId: organisationId },
    select: { id: true, name: true, category: true, updatedAt: true },
  });
  if (!form) {
    throw new FormServiceError("Source form not found", 404);
  }

  const latestVersion = await prisma.formVersion.findFirst({
    where: { formId: sourceFormId },
    orderBy: { version: "desc" },
    select: { version: true, fieldsSnapshot: true },
  });

  return {
    id: form.id,
    name: form.name,
    category: form.category,
    updatedAt: form.updatedAt,
    latestVersion: latestVersion
      ? {
          version: latestVersion.version,
          fieldsSnapshot: (latestVersion.fieldsSnapshot ??
            []) as unknown as FormField[],
        }
      : null,
  };
};

export interface CreateDraftImportInput {
  organisationId: string;
  userId: string;
  suppliedText: string;
  sourceFormId?: string;
}

export interface DraftImportView {
  id: string;
  organisationId: string;
  sourceFormId: string | null;
  draftFormId: string;
  suppliedText: string;
  fields: ParsedDraftField[];
  unsupportedConstructs: UnsupportedConstruct[];
  diff: FieldDiffEntry[];
  stale: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ValidatedCreateInput {
  organisationId: string;
  userId: string;
  suppliedText: string;
  sourceForm: SourceFormContext | null;
}

const validateCreateInput = async (
  input: CreateDraftImportInput,
): Promise<ValidatedCreateInput> => {
  const organisationId = ensureId(input.organisationId, "organisationId");
  const userId = ensureId(input.userId, "userId");
  const suppliedText = input.suppliedText ?? "";

  if (!suppliedText.trim()) {
    throw new FormServiceError("suppliedText must not be empty", 400);
  }
  if (suppliedText.length > MAX_SUPPLIED_TEXT_LENGTH) {
    throw new FormServiceError(
      `suppliedText must not exceed ${MAX_SUPPLIED_TEXT_LENGTH} characters`,
      400,
    );
  }

  const sourceFormId = input.sourceFormId?.trim() || undefined;
  const sourceForm = sourceFormId
    ? await loadSourceForm(organisationId, sourceFormId)
    : null;

  return { organisationId, userId, suppliedText, sourceForm };
};

const createDraftForm = async (
  organisationId: string,
  userId: string,
  sourceForm: SourceFormContext | null,
  fields: ParsedDraftField[],
): Promise<string> => {
  const draftFormLike: FormType = {
    _id: "",
    orgId: organisationId,
    name: sourceForm ? `${sourceForm.name} (draft import)` : "Imported form",
    category: sourceForm?.category ?? "General",
    visibilityType: "Internal",
    status: "draft",
    schema: toFormFieldSchema(fields),
    requiredSigner: hasSignatureField(fields) ? "CLIENT" : undefined,
    createdBy: userId,
    updatedBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const questionnaire = toFHIRQuestionnaire(draftFormLike);
  const created = await FormService.create(
    organisationId,
    questionnaire,
    userId,
  );
  const draftFormId = created.id;
  if (!draftFormId) {
    // Defensive only - FormService.create always returns the persisted id.
    throw new FormServiceError("Failed to create draft form", 500);
  }
  return draftFormId;
};

export const FormDraftImportService = {
  async create(input: CreateDraftImportInput): Promise<DraftImportView> {
    const { organisationId, userId, suppliedText, sourceForm } =
      await validateCreateInput(input);

    const { fields, unsupportedConstructs } =
      parseSuppliedFormText(suppliedText);

    if (fields.length === 0) {
      throw new FormServiceError(
        "No supported fields were found in suppliedText",
        400,
      );
    }

    const draftFormId = await createDraftForm(
      organisationId,
      userId,
      sourceForm,
      fields,
    );

    const record = await prisma.formDraftImport.create({
      data: {
        organisationId,
        sourceFormId: sourceForm?.id,
        sourceFormVersionAtImport: sourceForm?.latestVersion?.version,
        sourceFormUpdatedAtImport: sourceForm?.updatedAt,
        draftFormId,
        suppliedText,
        unsupportedConstructs:
          unsupportedConstructs as unknown as Prisma.InputJsonValue,
        createdByUserId: userId,
      },
    });

    const diff = computeFieldDiff(
      sourceForm?.latestVersion?.fieldsSnapshot ?? [],
      fields,
    );

    logger.info("Created form draft import", {
      organisationId,
      draftFormId,
      sourceFormId: sourceForm?.id ?? null,
      unsupportedCount: unsupportedConstructs.length,
    });

    return {
      id: record.id,
      organisationId,
      sourceFormId: sourceForm?.id ?? null,
      draftFormId,
      suppliedText,
      fields,
      unsupportedConstructs,
      diff,
      stale: false,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  },

  async get(organisationId: string, id: string): Promise<DraftImportView> {
    const oid = ensureId(organisationId, "organisationId");
    const importId = ensureId(id, "id");

    const record = await prisma.formDraftImport.findFirst({
      where: { id: importId, organisationId: oid },
    });
    if (!record) {
      throw new FormServiceError("Draft import not found", 404);
    }

    const { fields, unsupportedConstructs } = parseSuppliedFormText(
      record.suppliedText,
    );

    let baseFields: FormField[] = [];
    let stale = false;

    if (record.sourceFormId) {
      const currentSource = await prisma.form.findUnique({
        where: { id: record.sourceFormId },
        select: { updatedAt: true },
      });
      const latestVersion = await prisma.formVersion.findFirst({
        where: { formId: record.sourceFormId },
        orderBy: { version: "desc" },
        select: { version: true, fieldsSnapshot: true },
      });

      baseFields = (latestVersion?.fieldsSnapshot ??
        []) as unknown as FormField[];

      const versionChanged =
        (latestVersion?.version ?? null) !==
        (record.sourceFormVersionAtImport ?? null);
      const updatedAtChanged =
        currentSource === null ||
        record.sourceFormUpdatedAtImport === null ||
        currentSource.updatedAt.getTime() !==
          record.sourceFormUpdatedAtImport?.getTime();

      stale = versionChanged || updatedAtChanged;
    }

    return {
      id: record.id,
      organisationId: record.organisationId,
      sourceFormId: record.sourceFormId,
      draftFormId: record.draftFormId,
      suppliedText: record.suppliedText,
      fields,
      unsupportedConstructs,
      diff: computeFieldDiff(baseFields, fields),
      stale,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  },

  /**
   * Discards a draft import: removes the draft Form (cascading this record)
   * as long as it is still a draft. A form that was published after being
   * created here has entered the existing human publish path and this
   * discard action must not touch it - that path owns it now.
   */
  async discard(organisationId: string, id: string): Promise<void> {
    const oid = ensureId(organisationId, "organisationId");
    const importId = ensureId(id, "id");

    const record = await prisma.formDraftImport.findFirst({
      where: { id: importId, organisationId: oid },
    });
    if (!record) {
      throw new FormServiceError("Draft import not found", 404);
    }

    const draftForm = await prisma.form.findUnique({
      where: { id: record.draftFormId },
      select: { status: true },
    });
    if (!draftForm) {
      // The Form is already gone; only the tracking row is left to clean up.
      await prisma.formDraftImport.delete({ where: { id: record.id } });
      return;
    }
    if (draftForm.status !== "draft") {
      throw new FormServiceError(
        "This draft has already been published and can no longer be discarded here",
        409,
      );
    }

    // Deleting the Form cascades to FormDraftImport (draftFormId FK) and to
    // FormField/FormVersion/FormSubmission via their own cascades.
    await prisma.form.delete({ where: { id: record.draftFormId } });
  },
};
