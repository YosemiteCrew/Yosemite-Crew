import { jest } from "@jest/globals";
import { HospitalizationMonitoringController } from "src/controllers/web/hospitalization-monitoring.controller";
import {
  HospitalizationMonitoringService,
  HospitalizationMonitoringError,
} from "src/services/hospitalization-monitoring.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/hospitalization-monitoring.service", () => {
  const actual = jest.requireActual(
    "src/services/hospitalization-monitoring.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    HospitalizationMonitoringService: {
      list: jest.fn(),
      record: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "HospitalizationMonitoringController",
  controller: HospitalizationMonitoringController,
  service: HospitalizationMonitoringService as unknown as Record<
    string,
    unknown
  >,
  errorClass: HospitalizationMonitoringError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        admissionId: SECOND_ID,
        from: "2026-02-20T00:00:00.000Z",
        to: "2026-02-21T00:00:00.000Z",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          admissionId: SECOND_ID,
          from: new Date("2026-02-20T00:00:00.000Z"),
          to: new Date("2026-02-21T00:00:00.000Z"),
        },
      ],
      fallback: "Failed to list monitoring observations",
      invalidPayload: { admissionId: "not-a-uuid" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { encounterId: ENCOUNTER_ID },
      serviceMethod: "list",
      expectArgs: [{ organisationId: ORG_ID, encounterId: ENCOUNTER_ID }],
      fallback: "Failed to list monitoring observations",
    },
    {
      handler: "record",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        admissionId: SECOND_ID,
        observedAt: "2026-02-20T06:00:00.000Z",
        temperature: 38.6,
        temperatureUnit: "C",
        heartRate: 96,
        respiratoryRate: 24,
        spo2: 97,
        painScore: 2,
        inputMl: 120,
        outputMl: 90,
        mucousMembranes: "Pink and moist",
      },
      serviceMethod: "record",
      expectArgs: [
        {
          organisationId: ORG_ID,
          observedBy: USER_ID,
          patientId: PATIENT_ID,
          admissionId: SECOND_ID,
          temperature: 38.6,
          temperatureUnit: "C",
          heartRate: 96,
          respiratoryRate: 24,
          spo2: 97,
          painScore: 2,
          inputMl: 120,
          outputMl: 90,
          mucousMembranes: "Pink and moist",
          observedAt: new Date("2026-02-20T06:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record monitoring observation",
      // painScore runs 0-10.
      invalidPayload: {
        patientId: PATIENT_ID,
        observedAt: "2026-02-20T06:00:00.000Z",
        painScore: 15,
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, obsId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get monitoring observation",
    },
    {
      handler: "delete",
      params: { organisationId: ORG_ID, obsId: RECORD_ID },
      serviceMethod: "delete",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to delete monitoring observation",
    },
  ],
});
