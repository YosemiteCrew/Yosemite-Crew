import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "src/config/prisma";

export type ProfileEntityType = "CLIENT" | "PATIENT";
export type ProfileFieldType =
  "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";

export type ProfileFieldInput = {
  label: string;
  type: ProfileFieldType;
  options: string[];
};

export type ProfileFieldValueInput = {
  fieldId: string;
  value: unknown;
};

export class PracticeProfileFieldsError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "PracticeProfileFieldsError";
  }
}

const invalidRequest = () =>
  new PracticeProfileFieldsError("Invalid request.", 400);
const notFound = () =>
  new PracticeProfileFieldsError("Profile not found.", 404);
const uuidSchema = z.uuid();
const parseUuid = (value: unknown) =>
  uuidSchema.parse(typeof value === "string" ? value : "");

const slugify = (label: string) =>
  label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

const isValidDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const validateValue = (
  type: ProfileFieldType,
  options: string[],
  value: unknown,
) => {
  if (value === null || value === "") return true;
  switch (type) {
    case "TEXT":
      return typeof value === "string" && value.length <= 1000;
    case "NUMBER":
      return typeof value === "number" && Number.isFinite(value);
    case "DATE":
      return isValidDate(value);
    case "BOOLEAN":
      return typeof value === "boolean";
    case "SELECT":
      return typeof value === "string" && options.includes(value);
  }
};

const assertProfileAccess = async (
  entityType: ProfileEntityType,
  entityId: string,
  organisationId: string,
) => {
  entityId = parseUuid(entityId);
  const found =
    entityType === "PATIENT"
      ? await prisma.patientOrganisation.findFirst({
          where: { patientId: entityId, organisationId, status: "ACTIVE" },
          select: { id: true },
        })
      : await prisma.parentPatient.findFirst({
          where: {
            parentId: entityId,
            status: "ACTIVE",
            patient: {
              organisations: {
                some: { organisationId, status: "ACTIVE" },
              },
            },
          },
          select: { id: true },
        });
  if (!found) throw notFound();
};

const normalizeFieldInput = (input: ProfileFieldInput) => {
  const label = input.label.trim();
  const options = input.options.map((option) => option.trim()).filter(Boolean);
  if (
    !label ||
    label.length > 80 ||
    options.length > 50 ||
    options.some((option) => option.length > 80) ||
    (input.type === "SELECT" &&
      (options.length < 2 ||
        options.length > 50 ||
        new Set(options).size !== options.length)) ||
    (input.type !== "SELECT" && options.length > 0)
  ) {
    throw invalidRequest();
  }
  const fieldKey = slugify(label);
  if (!fieldKey) throw invalidRequest();
  return { label, fieldKey, type: input.type, options };
};

export const PracticeProfileFieldsService = {
  async list(
    entityType: ProfileEntityType,
    entityId: string,
    organisationId: string,
  ) {
    await assertProfileAccess(entityType, entityId, organisationId);
    const fields = await prisma.practiceProfileField.findMany({
      where: { organisationId, entityType, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { values: { where: { entityId }, select: { value: true } } },
    });
    return fields.map(({ values, ...field }) => ({
      ...field,
      value: values[0]?.value ?? null,
    }));
  },

  async create(
    entityType: ProfileEntityType,
    organisationId: string,
    input: ProfileFieldInput,
  ) {
    const normalized = normalizeFieldInput(input);
    try {
      return await prisma.practiceProfileField.create({
        data: { ...normalized, entityType, organisationId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new PracticeProfileFieldsError(
          "A field with that label already exists.",
          409,
        );
      }
      throw error;
    }
  },

  async deactivate(fieldId: string, organisationId: string) {
    fieldId = parseUuid(fieldId);
    const count = await prisma.$executeRaw`
      UPDATE "PracticeProfileField"
      SET "isActive" = false, "updatedAt" = NOW()
      WHERE "id" = ${fieldId}
        AND "organisationId" = ${organisationId}
        AND "isActive" = true
    `;
    if (count === 0) throw notFound();
  },

  async saveValues(
    entityType: ProfileEntityType,
    entityId: string,
    organisationId: string,
    values: ProfileFieldValueInput[],
  ) {
    await assertProfileAccess(entityType, entityId, organisationId);
    values = values.map((item) => ({
      ...item,
      fieldId: parseUuid(item.fieldId),
    }));
    const fieldIds = values.map(({ fieldId }) => fieldId);
    if (new Set(fieldIds).size !== fieldIds.length) throw invalidRequest();

    const fields = await prisma.practiceProfileField.findMany({
      where: {
        id: { in: fieldIds },
        organisationId,
        entityType,
        isActive: true,
      },
      select: { id: true, type: true, options: true },
    });
    if (fields.length !== fieldIds.length) throw notFound();

    const byId = new Map(fields.map((field) => [field.id, field]));
    for (const item of values) {
      const field = byId.get(item.fieldId);
      if (!field || !validateValue(field.type, field.options, item.value)) {
        throw invalidRequest();
      }
    }

    await prisma.$transaction(
      values.map(({ fieldId, value }) =>
        value === null || value === ""
          ? prisma.$executeRaw`
              DELETE FROM "PracticeProfileFieldValue"
              WHERE "organisationId" = ${organisationId}
                AND "entityType" = ${entityType}::"PracticeProfileFieldEntity"
                AND "entityId" = ${entityId}
                AND "fieldId" = ${fieldId}
            `
          : prisma.practiceProfileFieldValue.upsert({
              where: { fieldId_entityId: { fieldId, entityId } },
              create: {
                fieldId,
                entityId,
                entityType,
                organisationId,
                value: value as Prisma.InputJsonValue,
              },
              update: { value: value as Prisma.InputJsonValue },
            }),
      ),
    );
  },
};
