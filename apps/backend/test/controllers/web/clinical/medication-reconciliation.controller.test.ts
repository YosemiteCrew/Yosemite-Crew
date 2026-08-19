import { jest } from "@jest/globals";
import { MedicationReconciliationController } from "src/controllers/web/medication-reconciliation.controller";
import {
  MedicationReconciliationService,
  MedicationReconciliationError,
} from "src/services/medication-reconciliation.service";
import {
  ENCOUNTER_ID,
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/medication-reconciliation.service", () => {
  const actual = jest.requireActual(
    "src/services/medication-reconciliation.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    MedicationReconciliationService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      complete: jest.fn(),
      review: jest.fn(),
    },
  };
});

const homeMedications = [
  { name: "Phenobarbital", dose: "30mg", frequency: "BID", route: "PO" },
];
const hospitalOrders = [
  {
    name: "Phenobarbital",
    dose: "60mg",
    frequency: "BID",
    route: "PO",
    orderedBy: "Dr Lin",
  },
];
const discrepancies = [
  {
    type: "CHANGED_DOSE" as const,
    medication: "Phenobarbital",
    comment: "Dose doubled on admission",
  },
];

runClinicalControllerSuite({
  name: "MedicationReconciliationController",
  controller: MedicationReconciliationController,
  service: MedicationReconciliationService as unknown as Record<
    string,
    unknown
  >,
  errorClass: MedicationReconciliationError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "PENDING_REVIEW" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          status: "PENDING_REVIEW",
        },
      ],
      fallback: "Failed to list medication reconciliations",
      invalidPayload: { status: "DONE" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        encounterId: ENCOUNTER_ID,
        homeMedications,
        hospitalOrders,
        discrepancies,
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          reconciledBy: USER_ID,
          patientId: PATIENT_ID,
          encounterId: ENCOUNTER_ID,
          homeMedications,
          hospitalOrders,
          discrepancies,
        },
      ],
      status: 201,
      fallback: "Failed to create medication reconciliation",
      // Both medication lists are required, even when empty.
      invalidPayload: { patientId: PATIENT_ID, homeMedications },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, medRecId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get medication reconciliation",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, medRecId: RECORD_ID },
      body: { discrepancies, notes: "Confirmed with owner" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { discrepancies, notes: "Confirmed with owner" },
      ],
      fallback: "Failed to update medication reconciliation",
      // An unknown discrepancy type must be rejected.
      invalidPayload: {
        discrepancies: [{ type: "RENAMED", medication: "Phenobarbital" }],
      },
    },
    {
      handler: "complete",
      params: { organisationId: ORG_ID, medRecId: RECORD_ID },
      body: { discrepancies },
      serviceMethod: "complete",
      expectArgs: [RECORD_ID, ORG_ID, { discrepancies }, USER_ID],
      fallback: "Failed to complete medication reconciliation",
      invalidPayload: { discrepancies: [{ medication: "" }] },
    },
    {
      handler: "review",
      params: { organisationId: ORG_ID, medRecId: RECORD_ID },
      body: { reviewNotes: "Agreed with the admitting clinician" },
      serviceMethod: "review",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { reviewNotes: "Agreed with the admitting clinician" },
        USER_ID,
      ],
      fallback: "Failed to review medication reconciliation",
      invalidPayload: { reviewNotes: 3 },
    },
    {
      handler: "review",
      params: { organisationId: ORG_ID, medRecId: RECORD_ID },
      // With no resolved user the reviewer is recorded as "unknown".
      body: {},
      withoutUser: true,
      serviceMethod: "review",
      expectArgs: [RECORD_ID, ORG_ID, {}, "unknown"],
      fallback: "Failed to review medication reconciliation",
    },
  ],
});
