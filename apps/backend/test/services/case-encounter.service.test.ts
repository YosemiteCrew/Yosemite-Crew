import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  CaseEncounterService,
  CaseEncounterServiceError,
} from "../../src/services/case-encounter.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    case: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    encounter: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    roomUnit: {
      findUnique: jest.fn(),
    },
    roomUnitGroup: {
      findUnique: jest.fn(),
    },
    companion: {
      findUnique: jest.fn(),
    },
    roomUnitAssignment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    admission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;

const baseCaseRow = {
  id: "case_1",
  organisationId: "org_1",
  patientId: "comp_1",
  parentId: "parent_1",
  status: "active",
  appointmentKind: "INPATIENT" as const,
  title: "Case title",
  description: "Case description",
  createdAt: new Date("2026-06-11T10:00:00.000Z"),
  updatedAt: new Date("2026-06-11T10:00:00.000Z"),
};

const baseEncounterRow = {
  id: "enc_1",
  caseId: "case_1",
  organisationId: "org_1",
  patientId: "comp_1",
  parentId: "parent_1",
  status: "planned",
  encounterClass: "IMP",
  appointmentKind: "INPATIENT" as const,
  title: "Admission encounter",
  reason: "Observation",
  periodStart: new Date("2026-06-11T10:30:00.000Z"),
  periodEnd: new Date("2026-06-11T11:00:00.000Z"),
  createdAt: new Date("2026-06-11T10:00:00.000Z"),
  updatedAt: new Date("2026-06-11T10:00:00.000Z"),
};

describe("CaseEncounterService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback(mockedPrisma),
    );
    mockedPrisma.companion.findUnique.mockResolvedValue({
      id: "comp_1",
      type: "dog",
      speciesCode: "canislf",
    } as never);
    mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue(null);
    mockedPrisma.admission.findMany.mockResolvedValue([] as never);
  });

  it("creates a case", async () => {
    mockedPrisma.case.create.mockResolvedValue(baseCaseRow as never);

    const result = await CaseEncounterService.createCase({
      organisationId: "org_1",
      patientId: "comp_1",
      parentId: "parent_1",
      status: "active",
      appointmentKind: "INPATIENT",
      title: "Case title",
      description: "Case description",
    });

    expect(mockedPrisma.case.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: "org_1",
        patientId: "comp_1",
        status: "active",
        appointmentKind: "INPATIENT",
      }),
    });
    expect(result.id).toBe("case_1");
  });

  it("rejects invalid case and encounter status values", async () => {
    await expect(
      CaseEncounterService.createCase({
        organisationId: "org_1",
        patientId: "comp_1",
        parentId: "parent_1",
        status: "bogus" as never,
        appointmentKind: "INPATIENT",
      } as never),
    ).rejects.toMatchObject({
      message: "Invalid case status.",
      statusCode: 400,
    } satisfies Partial<CaseEncounterServiceError>);

    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    await expect(
      CaseEncounterService.createEncounter({
        caseId: "case_1",
        organisationId: "org_1",
        patientId: "comp_1",
        status: "planned",
        encounterClass: "bogus" as never,
        appointmentKind: "INPATIENT",
      } as never),
    ).rejects.toMatchObject({
      message: "Invalid encounter class.",
      statusCode: 400,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("creates an encounter and links the appointment", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_1",
      caseId: null,
      encounterId: null,
      organisationId: "org_1",
      patient: { id: "comp_1" },
    } as never);
    mockedPrisma.encounter.create.mockResolvedValue(baseEncounterRow as never);
    mockedPrisma.appointment.update.mockResolvedValue({
      id: "appt_1",
    } as never);

    const result = await CaseEncounterService.createEncounter({
      caseId: "case_1",
      appointmentId: "appt_1",
      organisationId: "org_1",
      patientId: "comp_1",
      parentId: "parent_1",
      status: "planned",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      title: "Admission encounter",
      reason: "Observation",
      periodStart: new Date("2026-06-11T10:30:00.000Z"),
      periodEnd: new Date("2026-06-11T11:00:00.000Z"),
    });

    expect(mockedPrisma.encounter.create).toHaveBeenCalled();
    expect(mockedPrisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: {
        caseId: "case_1",
        encounterId: "enc_1",
      },
    });
    expect(result.appointmentId).toBe("appt_1");
  });

  it("rejects encounter creation when appointment belongs to another companion", async () => {
    mockedPrisma.case.findUnique.mockResolvedValue(baseCaseRow as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_1",
      caseId: null,
      encounterId: null,
      organisationId: "org_1",
      patient: { id: "comp_2" },
    } as never);

    await expect(
      CaseEncounterService.createEncounter({
        caseId: "case_1",
        appointmentId: "appt_1",
        organisationId: "org_1",
        patientId: "comp_1",
        status: "planned",
        encounterClass: "IMP",
        appointmentKind: "INPATIENT",
      }),
    ).rejects.toMatchObject({
      message: "Encounter appointment companion mismatch.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("updates an encounter and re-links the appointment", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.appointment.findFirst.mockResolvedValue({
      id: "appt_old",
      caseId: "case_1",
      encounterId: "enc_1",
      organisationId: "org_1",
      patient: { id: "comp_1" },
    } as never);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      id: "appt_new",
      caseId: "case_1",
      encounterId: null,
      organisationId: "org_1",
      patient: { id: "comp_1" },
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "arrived",
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_new", encounterId: "enc_1" },
    ] as never);

    const result = await CaseEncounterService.updateEncounter("enc_1", {
      appointmentId: "appt_new",
      status: "arrived",
    });

    expect(mockedPrisma.appointment.update).toHaveBeenNthCalledWith(1, {
      where: { id: "appt_old" },
      data: { encounterId: null },
    });
    expect(mockedPrisma.appointment.update).toHaveBeenNthCalledWith(2, {
      where: { id: "appt_new" },
      data: {
        caseId: "case_1",
        encounterId: "enc_1",
      },
    });
    expect(result.status).toBe("arrived");
    expect(result.appointmentId).toBe("appt_new");
  });

  it("gets an encounter with its linked appointment id", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        bedUnitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.getEncounterById("enc_1");

    expect(result.id).toBe("enc_1");
    expect(result.appointmentId).toBe("appt_1");
    expect(result.admission?.encounterId).toBe("enc_1");
  });

  it("lists encounters with linked appointment ids", async () => {
    mockedPrisma.encounter.findMany.mockResolvedValue([
      baseEncounterRow,
      { ...baseEncounterRow, id: "enc_2", caseId: "case_2" },
    ] as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
      { id: "appt_2", encounterId: "enc_2" },
    ] as never);

    const results = await CaseEncounterService.listEncounters({
      organisationId: "org_1",
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.appointmentId).toBe("appt_1");
    expect(results[1]?.appointmentId).toBe("appt_2");
  });

  it("returns an empty list without loading appointments when no encounters exist", async () => {
    mockedPrisma.encounter.findMany.mockResolvedValue([] as never);

    const results = await CaseEncounterService.listEncounters({
      organisationId: "org_1",
    });

    expect(results).toEqual([]);
    expect(mockedPrisma.appointment.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.admission.findMany).not.toHaveBeenCalled();
  });

  it("discharges an inpatient encounter and closes admission", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      bedUnitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue({
      id: "assign_1",
      encounterId: "enc_1",
      admissionId: "enc_1",
      unitId: "unit_1",
      assignedAt: new Date("2026-06-11T11:00:00.000Z"),
      releasedAt: null,
      assignedBy: "user_1",
      reason: "Monitoring",
      createdAt: new Date("2026-06-11T11:00:00.000Z"),
      updatedAt: new Date("2026-06-11T11:00:00.000Z"),
    } as never);
    mockedPrisma.roomUnitAssignment.update.mockResolvedValue({
      id: "assign_1",
    } as never);
    mockedPrisma.admission.update.mockResolvedValue({
      encounterId: "enc_1",
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "finished",
      periodEnd: new Date("2026-06-11T12:00:00.000Z"),
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        bedUnitId: null,
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T12:00:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.dischargeEncounter("enc_1", {
      dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
    });

    expect(mockedPrisma.admission.update).toHaveBeenCalledWith({
      where: { encounterId: "enc_1" },
      data: {
        dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
        unitId: null,
      },
    });
    expect(mockedPrisma.roomUnitAssignment.update).toHaveBeenCalledWith({
      where: { id: "assign_1" },
      data: {
        releasedAt: new Date("2026-06-11T12:00:00.000Z"),
      },
    });
    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "finished",
        periodEnd: new Date("2026-06-11T12:00:00.000Z"),
      },
    });
    expect(result.status).toBe("finished");
    expect(result.admission?.dischargedAt?.toISOString()).toBe(
      "2026-06-11T12:00:00.000Z",
    );
  });

  it("rejects closing a finished encounter when marking ready for discharge", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue({
      ...baseEncounterRow,
      status: "finished",
    } as never);

    await expect(
      CaseEncounterService.markEncounterReadyForDischarge("enc_1"),
    ).rejects.toMatchObject({
      message: "Cannot mark ready for discharge a closed encounter.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("assigns a unit to an active admission", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    } as never);
    mockedPrisma.companion.findUnique.mockResolvedValue({
      id: "comp_1",
      type: "dog",
      speciesCode: "canislf",
    } as never);
    mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(null as never);
    mockedPrisma.roomUnitAssignment.create.mockResolvedValue({
      id: "assign_1",
    } as never);
    mockedPrisma.admission.update.mockResolvedValue({
      encounterId: "enc_1",
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T11:00:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.assignUnit("enc_1", {
      unitId: "unit_1",
      assignedBy: "user_1",
      reason: "Post-op monitoring",
      assignedAt: new Date("2026-06-11T11:00:00.000Z"),
    });

    expect(mockedPrisma.roomUnitAssignment.create).toHaveBeenCalledWith({
      data: {
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
        assignedBy: "user_1",
        reason: "Post-op monitoring",
      },
    });
    expect(mockedPrisma.admission.update).toHaveBeenCalledWith({
      where: { encounterId: "enc_1" },
      data: {
        unitId: "unit_1",
      },
    });
    expect(result.admission?.unitId).toBe("unit_1");
  });

  it("rejects assignment when the unit species constraints do not match", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["cat"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    } as never);
    mockedPrisma.companion.findUnique.mockResolvedValue({
      id: "comp_1",
      type: "dog",
      speciesCode: "canislf",
    } as never);

    await expect(
      CaseEncounterService.assignUnit("enc_1", {
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      message: "Room unit is not compatible with this companion's species.",
      statusCode: 409,
    });
  });

  it("rejects assignment when the unit group species constraints do not match", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: "group_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    } as never);
    mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue({
      id: "group_1",
      organisationId: "org_1",
      roomId: "room_1",
      name: "Cat ward",
      size: "M",
      unitCount: 2,
      speciesConstraints: ["cat"],
      capabilities: [],
      isActive: true,
    } as never);
    mockedPrisma.companion.findUnique.mockResolvedValue({
      id: "comp_1",
      type: "dog",
      speciesCode: "canislf",
    } as never);

    await expect(
      CaseEncounterService.assignUnit("enc_1", {
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      message:
        "Room unit group is not compatible with this companion's species.",
      statusCode: 409,
    });
  });

  it("rejects assignment when the unit is already occupied by another admission", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue(
      baseEncounterRow as never,
    );
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: null,
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date("2026-06-11T10:00:00.000Z"),
      updatedAt: new Date("2026-06-11T10:00:00.000Z"),
    } as never);
    mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue({
      id: "assign_other",
      encounterId: "enc_other",
      admissionId: "enc_other",
      unitId: "unit_1",
      assignedAt: new Date("2026-06-11T10:45:00.000Z"),
      releasedAt: null,
      assignedBy: "user_2",
      reason: "Occupied",
      createdAt: new Date("2026-06-11T10:45:00.000Z"),
      updatedAt: new Date("2026-06-11T10:45:00.000Z"),
    } as never);

    await expect(
      CaseEncounterService.assignUnit("enc_1", {
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      message: "Room unit is already occupied.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("lists unit assignment history for an encounter", async () => {
    mockedPrisma.roomUnitAssignment.findMany.mockResolvedValue([
      {
        id: "assign_1",
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
        releasedAt: new Date("2026-06-11T12:00:00.000Z"),
        assignedBy: "user_1",
        reason: "Transfer",
        createdAt: new Date("2026-06-11T11:00:00.000Z"),
        updatedAt: new Date("2026-06-11T12:00:00.000Z"),
      },
      {
        id: "assign_2",
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_2",
        assignedAt: new Date("2026-06-11T12:15:00.000Z"),
        releasedAt: null,
        assignedBy: "user_1",
        reason: null,
        createdAt: new Date("2026-06-11T12:15:00.000Z"),
        updatedAt: new Date("2026-06-11T12:15:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.listUnitAssignments({
      encounterId: "enc_1",
    });

    expect(mockedPrisma.roomUnitAssignment.findMany).toHaveBeenCalledWith({
      where: {
        encounterId: "enc_1",
        admissionId: undefined,
        unitId: undefined,
        releasedAt: undefined,
      },
      orderBy: { assignedAt: "asc" },
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.unitId).toBe("unit_1");
    expect(result[1]?.releasedAt).toBeUndefined();
  });

  it("lists unit assignment history for an admission", async () => {
    mockedPrisma.admission.findUnique.mockResolvedValue({
      encounterId: "enc_1",
      organisationId: "org_1",
      patientId: "comp_1",
      unitId: "unit_1",
      expectedStayDays: null,
      admittedAt: new Date("2026-06-11T10:30:00.000Z"),
      dischargedAt: null,
      createdAt: new Date("2026-06-11T10:30:00.000Z"),
      updatedAt: new Date("2026-06-11T10:30:00.000Z"),
    } as never);
    mockedPrisma.roomUnitAssignment.findMany.mockResolvedValue([
      {
        id: "assign_1",
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
        releasedAt: null,
        assignedBy: "user_1",
        reason: "Transfer",
        createdAt: new Date("2026-06-11T11:00:00.000Z"),
        updatedAt: new Date("2026-06-11T11:00:00.000Z"),
      },
    ] as never);

    const result =
      await CaseEncounterService.listAdmissionUnitAssignments("enc_1");

    expect(mockedPrisma.admission.findUnique).toHaveBeenCalledWith({
      where: { encounterId: "enc_1" },
    });
    expect(mockedPrisma.roomUnitAssignment.findMany).toHaveBeenCalledWith({
      where: {
        admissionId: "enc_1",
      },
      orderBy: { assignedAt: "asc" },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.admissionId).toBe("enc_1");
  });

  it("starts an encounter and keeps the original periodStart when present", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue({
      ...baseEncounterRow,
      status: "arrived",
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "in-progress",
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.startEncounter("enc_1", {
      startedAt: new Date("2026-06-11T12:00:00.000Z"),
    });

    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "in-progress",
        periodStart: new Date("2026-06-11T10:30:00.000Z"),
      },
    });
    expect(result.status).toBe("in-progress");
  });

  it("marks an encounter ready for discharge", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue({
      ...baseEncounterRow,
      status: "in-progress",
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "onleave",
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValue([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
    ] as never);

    const result =
      await CaseEncounterService.markEncounterReadyForDischarge("enc_1");

    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "onleave",
      },
    });
    expect(result.status).toBe("onleave");
  });

  it("reverts ready for discharge back to in-progress", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue({
      ...baseEncounterRow,
      status: "onleave",
    } as never);
    mockedPrisma.encounter.update.mockResolvedValue({
      ...baseEncounterRow,
      status: "in-progress",
    } as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
    ] as never);

    const result =
      await CaseEncounterService.markEncounterNotReadyForDischarge("enc_1");

    expect(mockedPrisma.encounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: {
        status: "in-progress",
      },
    });
    expect(result.status).toBe("in-progress");
  });

  it("rejects undo ready for discharge when encounter is not onleave", async () => {
    mockedPrisma.encounter.findUnique.mockResolvedValue({
      ...baseEncounterRow,
      status: "in-progress",
    } as never);

    await expect(
      CaseEncounterService.markEncounterNotReadyForDischarge("enc_1"),
    ).rejects.toMatchObject({
      message:
        "Cannot undo ready for discharge unless the encounter is ready for discharge.",
      statusCode: 409,
    } satisfies Partial<CaseEncounterServiceError>);
  });

  it("lists active inpatient encounters for an organisation", async () => {
    mockedPrisma.admission.findMany.mockResolvedValueOnce([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
      {
        encounterId: "enc_2",
        organisationId: "org_1",
        patientId: "comp_2",
        unitId: "unit_2",
        expectedStayDays: 3,
        admittedAt: new Date("2026-06-11T11:00:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T11:00:00.000Z"),
        updatedAt: new Date("2026-06-11T11:00:00.000Z"),
      },
    ] as never);
    mockedPrisma.encounter.findMany.mockResolvedValue([
      {
        ...baseEncounterRow,
        id: "enc_1",
        status: "arrived",
        periodStart: new Date("2026-06-11T10:30:00.000Z"),
      },
      {
        ...baseEncounterRow,
        id: "enc_2",
        status: "in-progress",
        periodStart: new Date("2026-06-11T11:00:00.000Z"),
      },
    ] as never);
    mockedPrisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", encounterId: "enc_1" },
      { id: "appt_2", encounterId: "enc_2" },
    ] as never);
    mockedPrisma.admission.findMany.mockResolvedValueOnce([
      {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        expectedStayDays: null,
        admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T10:30:00.000Z"),
        updatedAt: new Date("2026-06-11T10:30:00.000Z"),
      },
      {
        encounterId: "enc_2",
        organisationId: "org_1",
        patientId: "comp_2",
        unitId: "unit_2",
        expectedStayDays: 3,
        admittedAt: new Date("2026-06-11T11:00:00.000Z"),
        dischargedAt: null,
        createdAt: new Date("2026-06-11T11:00:00.000Z"),
        updatedAt: new Date("2026-06-11T11:00:00.000Z"),
      },
    ] as never);

    const result = await CaseEncounterService.listActiveInpatientEncounters({
      organisationId: "org_1",
    });

    expect(mockedPrisma.admission.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        organisationId: "org_1",
        dischargedAt: null,
      },
    });
    expect(mockedPrisma.encounter.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["enc_1", "enc_2"],
        },
        organisationId: "org_1",
        appointmentKind: "INPATIENT",
        status: {
          in: ["arrived", "triaged", "in-progress", "onleave"],
        },
      },
      orderBy: { periodStart: "asc" },
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.appointmentId).toBe("appt_1");
    expect(result[0]?.admission?.unitId).toBe("unit_1");
  });
});
