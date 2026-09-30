import { jest } from "@jest/globals";
import { DentalExaminationController } from "src/controllers/web/dental-examination.controller";
import {
  DentalExaminationService,
  DentalExaminationError,
} from "src/services/dental-examination.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/dental-examination.service", () => {
  const actual = jest.requireActual(
    "src/services/dental-examination.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    DentalExaminationService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const findings = [
  {
    tooth: "104",
    condition: "FRACTURE" as const,
    mobilityGrade: "GRADE_1" as const,
    calculus: 2,
    periodontalDepth: 4,
  },
];

runClinicalControllerSuite({
  name: "DentalExaminationController",
  controller: DentalExaminationController,
  service: DentalExaminationService as unknown as Record<string, unknown>,
  errorClass: DentalExaminationError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, encounterId: ENCOUNTER_ID },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
        },
      ],
      fallback: "Failed to list dental examinations",
      invalidPayload: { patientId: "x".repeat(65) },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        examinedAt: "2026-01-20T10:00:00.000Z",
        overallGrade: "GRADE_3",
        findings,
        calculusScore: 2,
        procedures: ["Scale and polish"],
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          examinedBy: USER_ID,
          patientId: PATIENT_ID,
          overallGrade: "GRADE_3",
          findings,
          calculusScore: 2,
          procedures: ["Scale and polish"],
          examinedAt: new Date("2026-01-20T10:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create dental examination",
      // A per-tooth finding must name the tooth.
      invalidPayload: {
        patientId: PATIENT_ID,
        examinedAt: "2026-01-20T10:00:00.000Z",
        overallGrade: "GRADE_3",
        findings: [{ condition: "FRACTURE" }],
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, examId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get dental examination",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, examId: RECORD_ID },
      body: {
        overallGrade: "GRADE_4",
        gingivalScore: 3,
        calculusScore: null,
        notes: null,
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          overallGrade: "GRADE_4",
          gingivalScore: 3,
          calculusScore: null,
          notes: null,
        },
      ],
      fallback: "Failed to update dental examination",
      invalidPayload: { gingivalScore: 9 },
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, examId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete dental examination",
    },
  ],
});

describe("DentalExaminationController tooth numbering", () => {
  const createBody = (teeth: string[]) => ({
    patientId: PATIENT_ID,
    examinedAt: "2026-01-20T10:00:00.000Z",
    overallGrade: "GRADE_1",
    findings: teeth.map((tooth) => ({ tooth, condition: "NORMAL" })),
  });

  const send = async (
    handler: "create" | "update",
    body: unknown,
  ): Promise<{ status: unknown; service: jest.Mock }> => {
    const service = DentalExaminationService[handler] as unknown as jest.Mock;
    service.mockClear();
    service.mockResolvedValue({ id: RECORD_ID } as never);
    const json = jest.fn();
    const status = jest.fn((_code: number) => ({ json, send: jest.fn() }));
    await DentalExaminationController[handler](
      {
        params: { organisationId: ORG_ID, examId: RECORD_ID },
        query: {},
        body,
        userId: USER_ID,
      } as never,
      { status, json } as never,
    );
    return { status: status.mock.calls[0]?.[0], service };
  };

  it.each(["101", "210", "311", "411", "508", "809"])(
    "accepts Modified Triadan tooth %s",
    async (tooth) => {
      const { status, service } = await send("create", createBody([tooth]));
      expect(status).toBe(201);
      expect(service).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["001", "901", "100", "112", "1040", "UR canine", "10a"])(
    "rejects %s, which is not a Modified Triadan tooth number",
    async (tooth) => {
      const { status, service } = await send("create", createBody([tooth]));
      expect(status).toBe(400);
      expect(service).not.toHaveBeenCalled();
    },
  );

  it("rejects the same tooth charted twice on create and update", async () => {
    const created = await send("create", createBody(["104", "104"]));
    expect(created.status).toBe(400);
    expect(created.service).not.toHaveBeenCalled();

    const updated = await send("update", {
      findings: createBody(["204", "204"]).findings,
    });
    expect(updated.status).toBe(400);
    expect(updated.service).not.toHaveBeenCalled();
  });
});
