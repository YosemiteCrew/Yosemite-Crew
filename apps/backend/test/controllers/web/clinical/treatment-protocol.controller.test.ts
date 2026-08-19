import { jest } from "@jest/globals";
import { TreatmentProtocolController } from "src/controllers/web/treatment-protocol.controller";
import {
  TreatmentProtocolService,
  TreatmentProtocolError,
} from "src/services/treatment-protocol.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/treatment-protocol.service", () => {
  const actual = jest.requireActual(
    "src/services/treatment-protocol.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    TreatmentProtocolService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      addStep: jest.fn(),
      removeStep: jest.fn(),
      apply: jest.fn(),
    },
  };
});

const steps = [
  {
    stepOrder: 1,
    stepType: "MEDICATION" as const,
    title: "Pre-med",
    doseValue: 0.2,
    doseUnit: "mg/kg",
    routeOfAdmin: "IM",
  },
  { stepType: "TASK" as const, title: "Clip and prep" },
];

runClinicalControllerSuite({
  name: "TreatmentProtocolController",
  controller: TreatmentProtocolController,
  service: TreatmentProtocolService as unknown as Record<string, unknown>,
  errorClass: TreatmentProtocolError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { species: "CANINE", category: "DENTAL", isActive: "true" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          species: "CANINE",
          category: "DENTAL",
          isActive: true,
        },
      ],
      fallback: "Failed to list protocols",
      invalidPayload: { species: "REPTILE" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      // Anything other than "true"/"false" leaves the flag unset.
      query: { isActive: "yes" },
      serviceMethod: "list",
      expectArgs: [{ organisationId: ORG_ID, isActive: undefined }],
      fallback: "Failed to list protocols",
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        name: "Routine dental",
        description: "Scale, polish and chart",
        species: "CANINE",
        category: "DENTAL",
        steps,
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          name: "Routine dental",
          description: "Scale, polish and chart",
          species: "CANINE",
          category: "DENTAL",
          steps,
          createdById: USER_ID,
        },
      ],
      status: 201,
      fallback: "Failed to create protocol",
      // Every step needs a title.
      invalidPayload: {
        name: "Routine dental",
        steps: [{ stepType: "TASK", title: "" }],
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, protocolId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get protocol",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, protocolId: RECORD_ID },
      body: { name: "Routine dental (v2)", isActive: false },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { name: "Routine dental (v2)", isActive: false },
      ],
      fallback: "Failed to update protocol",
      invalidPayload: { category: "COSMETIC" },
    },
    {
      handler: "archive",
      params: { organisationId: ORG_ID, protocolId: RECORD_ID },
      serviceMethod: "archive",
      expectArgs: [RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to archive protocol",
    },
    {
      handler: "addStep",
      params: { organisationId: ORG_ID, protocolId: RECORD_ID },
      body: {
        stepType: "SERVICE",
        title: "Dental radiographs",
        serviceCode: "DENT-RAD",
        unitPrice: 45,
        quantity: 1,
      },
      serviceMethod: "addStep",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          stepType: "SERVICE",
          title: "Dental radiographs",
          serviceCode: "DENT-RAD",
          unitPrice: 45,
          quantity: 1,
        },
      ],
      status: 201,
      fallback: "Failed to add step",
      invalidPayload: { stepType: "REMINDER", title: "Dental radiographs" },
    },
    {
      handler: "removeStep",
      // Both ids come off the route; the step id is passed first.
      params: {
        organisationId: ORG_ID,
        protocolId: RECORD_ID,
        stepId: SECOND_ID,
      },
      serviceMethod: "removeStep",
      expectArgs: [SECOND_ID, RECORD_ID, ORG_ID],
      status: 204,
      fallback: "Failed to remove step",
    },
    {
      handler: "apply",
      params: { organisationId: ORG_ID, protocolId: RECORD_ID },
      body: {
        encounterId: "enc-77",
        patientId: PATIENT_ID,
        appointmentDate: "2026-04-02T09:00:00.000Z",
      },
      serviceMethod: "apply",
      expectArgs: [
        {
          protocolId: RECORD_ID,
          encounterId: "enc-77",
          patientId: PATIENT_ID,
          organisationId: ORG_ID,
          appliedById: USER_ID,
          appointmentDate: new Date("2026-04-02T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to apply protocol",
      invalidPayload: { encounterId: "", patientId: PATIENT_ID },
    },
    {
      handler: "apply",
      params: { organisationId: ORG_ID, protocolId: RECORD_ID },
      body: { encounterId: "enc-78", patientId: PATIENT_ID },
      serviceMethod: "apply",
      expectArgs: [
        {
          protocolId: RECORD_ID,
          encounterId: "enc-78",
          patientId: PATIENT_ID,
          organisationId: ORG_ID,
          appliedById: USER_ID,
          appointmentDate: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to apply protocol",
    },
  ],
});
