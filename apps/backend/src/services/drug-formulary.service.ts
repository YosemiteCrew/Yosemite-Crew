import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class DrugFormularyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DrugFormularyError";
  }
}

type FormularyCategory =
  | "ANALGESIC"
  | "ANTIBIOTIC"
  | "ANTIFUNGAL"
  | "ANTIPARASITIC"
  | "CARDIOVASCULAR"
  | "CHEMOTHERAPY"
  | "CONTROLLED_SUBSTANCE"
  | "DERMATOLOGY"
  | "ENDOCRINOLOGY"
  | "GASTROINTESTINAL"
  | "IMMUNOSUPPRESSANT"
  | "NEUROLOGY"
  | "OPHTHALMIC"
  | "RESPIRATORY"
  | "SEDATION_ANESTHESIA"
  | "VACCINE"
  | "OTHER";

export interface DosageInput {
  species: string;
  indication?: string;
  doseMin?: number;
  doseMax?: number;
  doseUnit?: string;
  route?: string;
  frequency?: string;
  maxDose?: number;
  notes?: string;
}

export interface CreateFormularyParams {
  organisationId: string;
  drugName: string;
  genericName?: string;
  category?: FormularyCategory;
  manufacturer?: string;
  concentration?: string;
  availableUnits?: string[];
  notes?: string;
  dosageEntries?: DosageInput[];
  createdBy?: string;
}

export interface UpdateFormularyParams {
  drugName?: string;
  genericName?: string;
  category?: FormularyCategory;
  manufacturer?: string;
  concentration?: string;
  availableUnits?: string[];
  isActive?: boolean;
  notes?: string;
}

const formularySelect = {
  id: true,
  organisationId: true,
  drugName: true,
  genericName: true,
  category: true,
  manufacturer: true,
  concentration: true,
  availableUnits: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  dosageEntries: {
    select: {
      id: true,
      species: true,
      indication: true,
      doseMin: true,
      doseMax: true,
      doseUnit: true,
      route: true,
      frequency: true,
      maxDose: true,
      notes: true,
    },
  },
} satisfies Prisma.DrugFormularySelect;

const assertFormulary = async (id: string, organisationId: string) => {
  const entry = await prisma.drugFormulary.findFirst({
    where: { id, organisationId },
    select: formularySelect,
  });
  if (!entry) {
    throw new DrugFormularyError("Drug formulary entry not found.", 404);
  }
  return entry;
};

export const DrugFormularyService = {
  async create(params: CreateFormularyParams) {
    const { organisationId, dosageEntries, createdBy, ...rest } = params;

    const entry = await prisma.drugFormulary.create({
      data: {
        organisationId,
        drugName: rest.drugName,
        genericName: rest.genericName ?? null,
        category: rest.category ?? "OTHER",
        manufacturer: rest.manufacturer ?? null,
        concentration: rest.concentration ?? null,
        availableUnits: rest.availableUnits ?? [],
        notes: rest.notes ?? null,
        dosageEntries: dosageEntries?.length
          ? {
              create: dosageEntries.map((d) => ({
                species: d.species,
                indication: d.indication ?? null,
                doseMin: d.doseMin ?? null,
                doseMax: d.doseMax ?? null,
                doseUnit: d.doseUnit ?? null,
                route: d.route ?? null,
                frequency: d.frequency ?? null,
                maxDose: d.maxDose ?? null,
                notes: d.notes ?? null,
              })),
            }
          : undefined,
      },
      select: formularySelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: "",
      eventType: "DRUG_FORMULARY_ENTRY_ADDED",
      actorType: "PMS_USER",
      actorId: createdBy ?? null,
      entityType: "COMPANION",
      entityId: entry.id,
      metadata: { drugName: rest.drugName, category: rest.category ?? "OTHER" },
    });

    return entry;
  },

  async get(id: string, organisationId: string) {
    return assertFormulary(id, organisationId);
  },

  async list(params: {
    organisationId: string;
    category?: FormularyCategory;
    isActive?: boolean;
    search?: string;
  }) {
    const { organisationId, category, isActive, search } = params;
    return prisma.drugFormulary.findMany({
      where: {
        organisationId,
        ...(category ? { category } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(search
          ? {
              OR: [
                { drugName: { contains: search, mode: "insensitive" } },
                { genericName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: formularySelect,
      orderBy: { drugName: "asc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateFormularyParams,
  ) {
    await assertFormulary(id, organisationId);

    const data: Prisma.DrugFormularyUpdateInput = {};
    if (params.drugName !== undefined) data.drugName = params.drugName;
    if (params.genericName !== undefined) data.genericName = params.genericName;
    if (params.category !== undefined) data.category = params.category;
    if (params.manufacturer !== undefined)
      data.manufacturer = params.manufacturer;
    if (params.concentration !== undefined)
      data.concentration = params.concentration;
    if (params.availableUnits !== undefined)
      data.availableUnits = params.availableUnits;
    if (params.isActive !== undefined) data.isActive = params.isActive;
    if (params.notes !== undefined) data.notes = params.notes;

    return prisma.drugFormulary.update({
      where: { id },
      data,
      select: formularySelect,
    });
  },

  async addDosage(id: string, organisationId: string, dosage: DosageInput) {
    await assertFormulary(id, organisationId);

    return prisma.drugFormularyDosage.create({
      data: {
        formularyId: id,
        species: dosage.species,
        indication: dosage.indication ?? null,
        doseMin: dosage.doseMin ?? null,
        doseMax: dosage.doseMax ?? null,
        doseUnit: dosage.doseUnit ?? null,
        route: dosage.route ?? null,
        frequency: dosage.frequency ?? null,
        maxDose: dosage.maxDose ?? null,
        notes: dosage.notes ?? null,
      },
      select: {
        id: true,
        species: true,
        indication: true,
        doseMin: true,
        doseMax: true,
        doseUnit: true,
        route: true,
        frequency: true,
        maxDose: true,
        notes: true,
      },
    });
  },

  async removeDosage(id: string, dosageId: string, organisationId: string) {
    await assertFormulary(id, organisationId);
    await prisma.drugFormularyDosage.delete({ where: { id: dosageId } });
  },

  async delete(id: string, organisationId: string) {
    await assertFormulary(id, organisationId);
    await prisma.drugFormulary.delete({ where: { id } });
  },
};
