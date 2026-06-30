import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { Prisma } from "@prisma/client";

export class TreatmentProtocolError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "TreatmentProtocolError";
  }
}

type Species = "CANINE" | "FELINE" | "AVIAN" | "EXOTIC" | "ALL";
type Category =
  | "WELLNESS"
  | "SURGICAL"
  | "EMERGENCY"
  | "DENTAL"
  | "DERMATOLOGY"
  | "ORTHOPEDIC"
  | "NUTRITION"
  | "OTHER";
type StepType = "TASK" | "MEDICATION" | "SERVICE" | "NOTE";

export interface StepInput {
  stepOrder?: number;
  stepType: StepType;
  title: string;
  description?: string;
  inventoryItemId?: string;
  doseValue?: number;
  doseUnit?: string;
  routeOfAdmin?: string;
  frequency?: string;
  durationDays?: number;
  assigneeRole?: string;
  dueDaysFromStart?: number;
  serviceCode?: string;
  unitPrice?: number;
  quantity?: number;
}

export interface CreateProtocolParams {
  organisationId: string;
  name: string;
  description?: string;
  species?: Species;
  category?: Category;
  createdById?: string;
  steps?: StepInput[];
}

export interface UpdateProtocolParams {
  name?: string;
  description?: string;
  species?: Species;
  category?: Category;
  isActive?: boolean;
}

export interface ListProtocolsParams {
  organisationId: string;
  species?: Species;
  category?: Category;
  isActive?: boolean;
}

export interface ApplyProtocolParams {
  protocolId: string;
  encounterId: string;
  patientId: string;
  organisationId: string;
  appliedById?: string;
  appointmentDate?: Date;
}

const stepSelect = {
  id: true,
  stepOrder: true,
  stepType: true,
  title: true,
  description: true,
  inventoryItemId: true,
  doseValue: true,
  doseUnit: true,
  routeOfAdmin: true,
  frequency: true,
  durationDays: true,
  assigneeRole: true,
  dueDaysFromStart: true,
  serviceCode: true,
  unitPrice: true,
  quantity: true,
} satisfies Prisma.TreatmentProtocolStepSelect;

const protocolSelect = {
  id: true,
  organisationId: true,
  name: true,
  description: true,
  species: true,
  category: true,
  isActive: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  steps: { select: stepSelect, orderBy: { stepOrder: "asc" } },
} satisfies Prisma.TreatmentProtocolSelect;

const assertProtocol = async (id: string, organisationId: string) => {
  const protocol = await prisma.treatmentProtocol.findFirst({
    where: { id, organisationId },
    select: protocolSelect,
  });
  if (!protocol) {
    throw new TreatmentProtocolError("Protocol not found.", 404);
  }
  return protocol;
};

export const TreatmentProtocolService = {
  async create(params: CreateProtocolParams) {
    const {
      organisationId,
      name,
      description,
      species,
      category,
      createdById,
      steps,
    } = params;
    return prisma.treatmentProtocol.create({
      data: {
        organisationId,
        name,
        description: description ?? null,
        species: species ?? "ALL",
        category: category ?? "OTHER",
        createdById: createdById ?? null,
        steps: steps?.length
          ? {
              create: steps.map((s, idx) => ({
                stepOrder: s.stepOrder ?? idx + 1,
                stepType: s.stepType,
                title: s.title,
                description: s.description ?? null,
                inventoryItemId: s.inventoryItemId ?? null,
                doseValue: s.doseValue ?? null,
                doseUnit: s.doseUnit ?? null,
                routeOfAdmin: s.routeOfAdmin ?? null,
                frequency: s.frequency ?? null,
                durationDays: s.durationDays ?? null,
                assigneeRole: s.assigneeRole ?? null,
                dueDaysFromStart: s.dueDaysFromStart ?? null,
                serviceCode: s.serviceCode ?? null,
                unitPrice: s.unitPrice ?? null,
                quantity: s.quantity ?? null,
              })),
            }
          : undefined,
      },
      select: protocolSelect,
    });
  },

  async get(id: string, organisationId: string) {
    return assertProtocol(id, organisationId);
  },

  async list(params: ListProtocolsParams) {
    const { organisationId, species, category, isActive } = params;
    return prisma.treatmentProtocol.findMany({
      where: {
        organisationId,
        ...(species ? { species } : {}),
        ...(category ? { category } : {}),
        isActive: isActive !== undefined ? isActive : true,
      },
      select: protocolSelect,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateProtocolParams,
  ) {
    await assertProtocol(id, organisationId);
    return prisma.treatmentProtocol.update({
      where: { id },
      data: {
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.description !== undefined
          ? { description: params.description }
          : {}),
        ...(params.species !== undefined ? { species: params.species } : {}),
        ...(params.category !== undefined ? { category: params.category } : {}),
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      },
      select: protocolSelect,
    });
  },

  async addStep(protocolId: string, organisationId: string, step: StepInput) {
    await assertProtocol(protocolId, organisationId);
    const maxOrder = await prisma.treatmentProtocolStep.aggregate({
      where: { protocolId },
      _max: { stepOrder: true },
    });
    const nextOrder = (maxOrder._max.stepOrder ?? 0) + 1;
    return prisma.treatmentProtocolStep.create({
      data: {
        protocolId,
        stepOrder: step.stepOrder ?? nextOrder,
        stepType: step.stepType,
        title: step.title,
        description: step.description ?? null,
        inventoryItemId: step.inventoryItemId ?? null,
        doseValue: step.doseValue ?? null,
        doseUnit: step.doseUnit ?? null,
        routeOfAdmin: step.routeOfAdmin ?? null,
        frequency: step.frequency ?? null,
        durationDays: step.durationDays ?? null,
        assigneeRole: step.assigneeRole ?? null,
        dueDaysFromStart: step.dueDaysFromStart ?? null,
        serviceCode: step.serviceCode ?? null,
        unitPrice: step.unitPrice ?? null,
        quantity: step.quantity ?? null,
      },
      select: stepSelect,
    });
  },

  async removeStep(stepId: string, protocolId: string, organisationId: string) {
    await assertProtocol(protocolId, organisationId);
    const step = await prisma.treatmentProtocolStep.findFirst({
      where: { id: stepId, protocolId },
    });
    if (!step) {
      throw new TreatmentProtocolError("Step not found.", 404);
    }
    await prisma.treatmentProtocolStep.delete({ where: { id: stepId } });
  },

  async archive(id: string, organisationId: string) {
    await assertProtocol(id, organisationId);
    await prisma.treatmentProtocol.update({
      where: { id },
      data: { isActive: false },
    });
  },

  async apply(params: ApplyProtocolParams) {
    const {
      protocolId,
      encounterId,
      patientId,
      organisationId,
      appliedById,
      appointmentDate,
    } = params;
    const protocol = await assertProtocol(protocolId, organisationId);

    const application = await prisma.appliedTreatmentProtocol.create({
      data: {
        protocolId,
        encounterId,
        patientId,
        organisationId,
        appliedById: appliedById ?? null,
        status: "IN_PROGRESS",
      },
    });

    const taskSteps = protocol.steps.filter((s) => s.stepType === "TASK");
    const baseDate = appointmentDate ?? new Date();
    const createdTaskIds: string[] = [];

    if (taskSteps.length > 0 && appliedById) {
      const tasks = await Promise.all(
        taskSteps.map((step) => {
          const dueAt = new Date(baseDate);
          dueAt.setDate(dueAt.getDate() + (step.dueDaysFromStart ?? 0));
          return prisma.task.create({
            data: {
              organisationId,
              patientId,
              createdBy: appliedById,
              assignedTo: appliedById,
              audience: "EMPLOYEE_TASK",
              source: "ORG_TEMPLATE",
              category: "PROTOCOL",
              name: step.title,
              description: step.description ?? null,
              dueAt,
            },
            select: { id: true },
          });
        }),
      );
      createdTaskIds.push(...tasks.map((t) => t.id));
    }

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "PROTOCOL_APPLIED",
      actorType: "PMS_USER",
      actorId: appliedById ?? null,
      entityType: "COMPANION",
      entityId: application.id,
      metadata: {
        protocolId,
        protocolName: protocol.name,
        encounterId,
        taskCount: createdTaskIds.length,
        stepCount: protocol.steps.length,
      },
    });

    return {
      application: {
        id: application.id,
        protocolId,
        encounterId,
        patientId,
        organisationId,
        appliedById: appliedById ?? null,
        status: application.status,
        appliedAt: application.appliedAt.toISOString(),
      },
      protocol: {
        name: protocol.name,
        stepCount: protocol.steps.length,
        taskStepCount: taskSteps.length,
      },
      createdTaskIds,
      pendingSteps: protocol.steps
        .filter((s) => s.stepType !== "TASK")
        .map((s) => ({
          stepType: s.stepType,
          title: s.title,
          description: s.description,
          inventoryItemId: s.inventoryItemId,
          doseValue: s.doseValue,
          doseUnit: s.doseUnit,
          routeOfAdmin: s.routeOfAdmin,
          frequency: s.frequency,
          durationDays: s.durationDays,
          serviceCode: s.serviceCode,
          unitPrice: s.unitPrice,
          quantity: s.quantity,
        })),
    };
  },
};
