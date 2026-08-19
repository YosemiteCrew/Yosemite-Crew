import { jest } from "@jest/globals";
import { InsuranceClaimController } from "src/controllers/web/insurance-claim.controller";
import {
  InsuranceClaimService,
  InsuranceClaimError,
} from "src/services/insurance-claim.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/insurance-claim.service", () => {
  const actual = jest.requireActual(
    "src/services/insurance-claim.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    InsuranceClaimService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      submit: jest.fn(),
      updateStatus: jest.fn(),
      cancel: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "InsuranceClaimController",
  controller: InsuranceClaimController,
  service: InsuranceClaimService as unknown as Record<string, unknown>,
  errorClass: InsuranceClaimError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "SUBMITTED", invoiceId: "INV-9" },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          status: "SUBMITTED",
          invoiceId: "INV-9",
        },
      ],
      fallback: "Failed to list insurance claims",
      invalidPayload: { status: "SETTLED" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        invoiceId: "INV-9",
        insurerName: "Petplan",
        policyNumber: "PP-4432",
        submittedAmount: 480.5,
        currency: "GBP",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          createdBy: USER_ID,
          patientId: PATIENT_ID,
          invoiceId: "INV-9",
          insurerName: "Petplan",
          policyNumber: "PP-4432",
          submittedAmount: 480.5,
          currency: "GBP",
        },
      ],
      status: 201,
      fallback: "Failed to create insurance claim",
      // The currency must be a 3 letter code.
      invalidPayload: {
        patientId: PATIENT_ID,
        insurerName: "Petplan",
        policyNumber: "PP-4432",
        submittedAmount: 100,
        currency: "POUNDS",
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, claimId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get insurance claim",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, claimId: RECORD_ID },
      body: { claimNumber: "CLM-7781", submittedAmount: 502 },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { claimNumber: "CLM-7781", submittedAmount: 502 },
      ],
      fallback: "Failed to update insurance claim",
      invalidPayload: { submittedAmount: 0 },
    },
    {
      handler: "submit",
      params: { organisationId: ORG_ID, claimId: RECORD_ID },
      serviceMethod: "submit",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to submit insurance claim",
    },
    {
      handler: "updateStatus",
      params: { organisationId: ORG_ID, claimId: RECORD_ID },
      body: {
        status: "PARTIALLY_APPROVED",
        approvedAmount: 300,
        rejectionReason: "Pre-existing condition excluded",
      },
      serviceMethod: "updateStatus",
      // The acting user is stamped onto the status change for the audit trail.
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          status: "PARTIALLY_APPROVED",
          approvedAmount: 300,
          rejectionReason: "Pre-existing condition excluded",
          updatedBy: USER_ID,
        },
      ],
      fallback: "Failed to update claim status",
      invalidPayload: { status: "APPROVED", approvedAmount: -10 },
    },
    {
      handler: "cancel",
      params: { organisationId: ORG_ID, claimId: RECORD_ID },
      serviceMethod: "cancel",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to cancel insurance claim",
    },
  ],
});
