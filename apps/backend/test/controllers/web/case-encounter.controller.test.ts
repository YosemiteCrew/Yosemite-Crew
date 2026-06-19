import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import {
  CaseController,
  EncounterController,
} from "../../../src/controllers/web/case-encounter.controller";
import {
  CaseEncounterService,
  CaseEncounterServiceError,
} from "../../../src/services/case-encounter.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/case-encounter.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/case-encounter.service",
  ) as Record<string, unknown>;

  return {
    ...actual,
    CaseEncounterService: {
      createCase: jest.fn(),
      updateCase: jest.fn(),
      getCaseById: jest.fn(),
      listCases: jest.fn(),
      createEncounter: jest.fn(),
      updateEncounter: jest.fn(),
      dischargeEncounter: jest.fn(),
      assignUnit: jest.fn(),
      listUnitAssignments: jest.fn(),
      listAdmissionUnitAssignments: jest.fn(),
      listActiveInpatientEncounters: jest.fn(),
      startEncounter: jest.fn(),
      markEncounterReadyForDischarge: jest.fn(),
      markEncounterNotReadyForDischarge: jest.fn(),
      getEncounterById: jest.fn(),
      listEncounters: jest.fn(),
    },
  };
});
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockedService = jest.mocked(CaseEncounterService);
const mockedLogger = jest.mocked(logger);

const buildResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
};

describe("CaseEncounterController", () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {} };
    res = buildResponse();
  });

  it("creates a case from EpisodeOfCare payload", async () => {
    req.body = {
      resourceType: "EpisodeOfCare",
      status: "active",
      patient: { reference: "Patient/comp_1" },
      managingOrganization: { reference: "Organization/org_1" },
      extension: [
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/case-appointment-kind",
          valueString: "OUTPATIENT",
        },
      ],
    };
    mockedService.createCase.mockResolvedValue({
      id: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "active",
      appointmentKind: "OUTPATIENT",
    } as never);

    await CaseController.create(req as any, res as any);

    expect(mockedService.createCase).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org_1",
        patientId: "comp_1",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "EpisodeOfCare",
        id: "case_1",
      }),
    );
  });

  it("lists cases as a FHIR Bundle", async () => {
    req.query = {
      organization: "Organization/org_1",
      patient: "Patient/comp_1",
      status: "active",
      appointmentKind: "OUTPATIENT",
    };
    mockedService.listCases.mockResolvedValue([
      {
        id: "case_1",
        organisationId: "org_1",
        patientId: "comp_1",
        status: "active",
        appointmentKind: "OUTPATIENT",
      },
    ] as never);

    await CaseController.list(req as any, res as any);

    expect(mockedService.listCases).toHaveBeenCalledWith({
      organisationId: "org_1",
      patientId: "comp_1",
      parentId: undefined,
      status: "active",
      appointmentKind: "OUTPATIENT",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Bundle",
        total: 1,
      }),
    );
  });

  it("creates an encounter from FHIR payload", async () => {
    req.body = {
      resourceType: "Encounter",
      status: "planned",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
      },
      subject: { reference: "Patient/comp_1" },
      episodeOfCare: [{ reference: "EpisodeOfCare/case_1" }],
      appointment: [{ reference: "Appointment/appt_1" }],
      serviceProvider: { reference: "Organization/org_1" },
      extension: [
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/encounter-appointment-kind",
          valueString: "OUTPATIENT",
        },
      ],
    };
    mockedService.createEncounter.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      appointmentId: "appt_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "planned",
      encounterClass: "AMB",
      appointmentKind: "OUTPATIENT",
    } as never);

    await EncounterController.create(req as any, res as any);

    expect(mockedService.createEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "case_1",
        appointmentId: "appt_1",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns service errors from encounter endpoints", async () => {
    req.params = { id: "enc_missing" };
    mockedService.getEncounterById.mockRejectedValue(
      new CaseEncounterServiceError("Encounter not found.", 404),
    );

    await EncounterController.getById(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Encounter not found.",
    });
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("discharges an encounter from Parameters payload", async () => {
    req.params = { id: "enc_1" };
    req.body = {
      resourceType: "Parameters",
      parameter: [
        {
          name: "dischargedAt",
          valueDateTime: "2026-06-11T12:00:00.000Z",
        },
      ],
    };
    mockedService.dischargeEncounter.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "finished",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
    } as never);

    await EncounterController.discharge(req as any, res as any);

    expect(mockedService.dischargeEncounter).toHaveBeenCalledWith("enc_1", {
      dischargedAt: new Date("2026-06-11T12:00:00.000Z"),
      periodEnd: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("assigns a unit from Parameters payload", async () => {
    req.params = { id: "enc_1" };
    req.body = {
      resourceType: "Parameters",
      parameter: [
        { name: "unitId", valueString: "unit_1" },
        { name: "assignedBy", valueString: "user_1" },
        { name: "reason", valueString: "Transfer to ICU unit" },
        { name: "assignedAt", valueDateTime: "2026-06-11T11:00:00.000Z" },
      ],
    };
    mockedService.assignUnit.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "arrived",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
      admission: {
        encounterId: "enc_1",
        organisationId: "org_1",
        patientId: "comp_1",
        unitId: "unit_1",
        admittedAt: new Date("2026-06-11T10:00:00.000Z"),
      },
    } as never);

    await EncounterController.assignUnit(req as any, res as any);

    expect(mockedService.assignUnit).toHaveBeenCalledWith("enc_1", {
      unitId: "unit_1",
      assignedBy: "user_1",
      reason: "Transfer to ICU unit",
      assignedAt: new Date("2026-06-11T11:00:00.000Z"),
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("lists unit assignments as Parameters payload", async () => {
    req.params = { id: "enc_1" };
    mockedService.listUnitAssignments.mockResolvedValue([
      {
        id: "assign_1",
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
        releasedAt: new Date("2026-06-11T12:00:00.000Z"),
        assignedBy: "user_1",
        reason: "Transfer",
      },
    ] as never);

    await EncounterController.listUnitAssignments(req as any, res as any);

    expect(mockedService.listUnitAssignments).toHaveBeenCalledWith({
      encounterId: "enc_1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Parameters",
        parameter: [
          expect.objectContaining({
            name: "assignment",
          }),
        ],
      }),
    );
  });

  it("lists admission unit assignments as Parameters payload", async () => {
    req.params = { id: "enc_1" };
    mockedService.listAdmissionUnitAssignments.mockResolvedValue([
      {
        id: "assign_1",
        encounterId: "enc_1",
        admissionId: "enc_1",
        unitId: "unit_1",
        assignedAt: new Date("2026-06-11T11:00:00.000Z"),
        releasedAt: null,
        assignedBy: "user_1",
        reason: "Monitoring",
      },
    ] as never);

    await EncounterController.listAdmissionUnitAssignments(
      req as any,
      res as any,
    );

    expect(mockedService.listAdmissionUnitAssignments).toHaveBeenCalledWith(
      "enc_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Parameters",
        parameter: [
          expect.objectContaining({
            name: "assignment",
          }),
        ],
      }),
    );
  });

  it("starts an encounter from Parameters payload", async () => {
    req.params = { id: "enc_1" };
    req.body = {
      resourceType: "Parameters",
      parameter: [
        { name: "startedAt", valueDateTime: "2026-06-11T12:00:00.000Z" },
      ],
    };
    mockedService.startEncounter.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
    } as never);

    await EncounterController.start(req as any, res as any);

    expect(mockedService.startEncounter).toHaveBeenCalledWith("enc_1", {
      startedAt: new Date("2026-06-11T12:00:00.000Z"),
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("marks an encounter ready for discharge", async () => {
    req.params = { id: "enc_1" };
    req.body = { resourceType: "Parameters" };
    mockedService.markEncounterReadyForDischarge.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "onleave",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
    } as never);

    await EncounterController.readyForDischarge(req as any, res as any);

    expect(mockedService.markEncounterReadyForDischarge).toHaveBeenCalledWith(
      "enc_1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("undoes ready for discharge", async () => {
    req.params = { id: "enc_1" };
    req.body = { resourceType: "Parameters" };
    mockedService.markEncounterNotReadyForDischarge.mockResolvedValue({
      id: "enc_1",
      caseId: "case_1",
      organisationId: "org_1",
      patientId: "comp_1",
      status: "in-progress",
      encounterClass: "IMP",
      appointmentKind: "INPATIENT",
    } as never);

    await EncounterController.undoReadyForDischarge(req as any, res as any);

    expect(
      mockedService.markEncounterNotReadyForDischarge,
    ).toHaveBeenCalledWith("enc_1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("lists active inpatient encounters as a Bundle", async () => {
    req.query = { organization: "Organization/org_1" };
    mockedService.listActiveInpatientEncounters.mockResolvedValue([
      {
        id: "enc_1",
        caseId: "case_1",
        appointmentId: "appt_1",
        organisationId: "org_1",
        patientId: "comp_1",
        status: "arrived",
        encounterClass: "IMP",
        appointmentKind: "INPATIENT",
        admission: {
          encounterId: "enc_1",
          organisationId: "org_1",
          patientId: "comp_1",
          unitId: "unit_1",
          admittedAt: new Date("2026-06-11T10:30:00.000Z"),
        },
      },
    ] as never);

    await EncounterController.listActiveInpatients(req as any, res as any);

    expect(mockedService.listActiveInpatientEncounters).toHaveBeenCalledWith({
      organisationId: "org_1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Bundle",
        total: 1,
      }),
    );
  });

  it("requires an organisation for active inpatient list", async () => {
    req.query = {};

    await EncounterController.listActiveInpatients(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "organization is required.",
    });
  });
});
