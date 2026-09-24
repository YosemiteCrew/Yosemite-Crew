import { jest } from "@jest/globals";
import { PocLabController } from "src/controllers/web/poc-lab.controller";
import { PocLabService, PocLabError } from "src/services/poc-lab.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/poc-lab.service", () => {
  const actual = jest.requireActual("src/services/poc-lab.service") as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    PocLabService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const results = [
  {
    name: "Creatinine",
    value: 210,
    unit: "umol/L",
    referenceRangeLow: 44,
    referenceRangeHigh: 159,
    flag: "H" as const,
  },
  { name: "Sample quality", value: "Haemolysed" },
];

runClinicalControllerSuite({
  name: "PocLabController",
  controller: PocLabController,
  service: PocLabService as unknown as Record<string, unknown>,
  errorClass: PocLabError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, testType: "BLOOD_CHEMISTRY" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          testType: "BLOOD_CHEMISTRY",
        },
      ],
      fallback: "Failed to list POC lab results",
      invalidPayload: { testType: "MAGIC_8_BALL" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        conductedAt: "2026-03-13T07:30:00.000Z",
        testType: "BLOOD_CHEMISTRY",
        analyzerName: "Catalyst One",
        sampleType: "Serum",
        results,
        abnormalFlags: ["Creatinine"],
        followUpRecommended: true,
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          conductedBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          testType: "BLOOD_CHEMISTRY",
          analyzerName: "Catalyst One",
          sampleType: "Serum",
          results,
          abnormalFlags: ["Creatinine"],
          followUpRecommended: true,
          conductedAt: new Date("2026-03-13T07:30:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create POC lab result",
      // At least one result row is required.
      invalidPayload: {
        patientId: PATIENT_ID,
        conductedAt: "2026-03-13T07:30:00.000Z",
        testType: "CBC",
        results: [],
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, recordId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get POC lab result",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, recordId: RECORD_ID },
      body: {
        overallInterpretation: "Consistent with azotaemia",
        criticalFlags: ["Creatinine"],
      },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          overallInterpretation: "Consistent with azotaemia",
          criticalFlags: ["Creatinine"],
        },
      ],
      fallback: "Failed to update POC lab result",
      invalidPayload: { followUpRecommended: "maybe" },
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, recordId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete POC lab result",
    },
  ],
});

describe("PocLabController.create body validation", () => {
  const createMock = PocLabService.create as unknown as jest.Mock;

  const send = async (body: Record<string, unknown>) => {
    const json = jest.fn();
    const status = jest.fn((_code: number) => ({ json, send: jest.fn() }));
    await PocLabController.create(
      {
        params: { organisationId: ORG_ID },
        query: {},
        body,
        userId: USER_ID,
      } as never,
      { status, json } as never,
    );
    return { status: status.mock.calls[0]?.[0] as unknown, json };
  };

  const valid = {
    patientId: PATIENT_ID,
    conductedAt: "2026-09-24T09:15:00.000Z",
    testType: "CBC",
    results: [{ name: "PLT", value: 38 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createMock.mockResolvedValue({ id: RECORD_ID } as never);
  });

  it("accepts a companion keyed by a 24-hex id, like the sibling clinical creates", async () => {
    const legacyId = "65f1c2a9b4d3e2f1a0b9c8d7";
    const { status } = await send({ ...valid, patientId: legacyId });
    expect(status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: legacyId }),
    );
  });

  it("trims parameter names and text values before they are stored", async () => {
    await send({
      ...valid,
      results: [{ name: "  Sample quality ", value: " Haemolysed " }],
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [{ name: "Sample quality", value: "Haemolysed" }],
      }),
    );
  });

  it.each([
    ["a blank text value", [{ name: "PLT", value: "   " }]],
    [
      "a text value over 100 characters",
      [{ name: "PLT", value: "x".repeat(101) }],
    ],
    ["a blank parameter name", [{ name: "  ", value: 38 }]],
    [
      "a reference high below the low",
      [
        {
          name: "PLT",
          value: 38,
          referenceRangeLow: 500,
          referenceRangeHigh: 200,
        },
      ],
    ],
    [
      "more than 100 parameters",
      Array.from({ length: 101 }, (_, i) => ({ name: `P${i}`, value: i })),
    ],
  ])(
    "answers 400 for %s and never reaches the service",
    async (_label, results) => {
      const { status } = await send({ ...valid, results });
      expect(status).toBe(400);
      expect(createMock).not.toHaveBeenCalled();
    },
  );

  it("accepts an equal reference low and high", async () => {
    const { status } = await send({
      ...valid,
      results: [
        {
          name: "PLT",
          value: 38,
          referenceRangeLow: 200,
          referenceRangeHigh: 200,
        },
      ],
    });
    expect(status).toBe(201);
  });
});
