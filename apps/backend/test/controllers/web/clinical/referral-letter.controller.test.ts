import { jest } from "@jest/globals";
import { ReferralLetterController } from "src/controllers/web/referral-letter.controller";
import {
  ReferralLetterService,
  ReferralLetterError,
} from "src/services/referral-letter.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/referral-letter.service", () => {
  const actual = jest.requireActual(
    "src/services/referral-letter.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    ReferralLetterService: {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      sign: jest.fn(),
      send: jest.fn(),
      cancel: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "ReferralLetterController",
  controller: ReferralLetterController,
  service: ReferralLetterService as unknown as Record<string, unknown>,
  errorClass: ReferralLetterError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: { patientId: PATIENT_ID, status: "SENT" },
      serviceMethod: "list",
      expectArgs: [
        { organisationId: ORG_ID, patientId: PATIENT_ID, status: "SENT" },
      ],
      fallback: "Failed to list referral letters",
      invalidPayload: { status: "POSTED" },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        specialistName: "Dr Novak",
        specialistClinic: "Northside Referrals",
        specialistEmail: "referrals@example.com",
        reasonForReferral: "Suspected IVDD, MRI required",
        currentMedications: "Gabapentin 10mg/kg BID",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          referringVetId: USER_ID,
          patientId: PATIENT_ID,
          specialistName: "Dr Novak",
          specialistClinic: "Northside Referrals",
          specialistEmail: "referrals@example.com",
          reasonForReferral: "Suspected IVDD, MRI required",
          currentMedications: "Gabapentin 10mg/kg BID",
        },
      ],
      status: 201,
      fallback: "Failed to create referral letter",
      // The specialist email must be a real address.
      invalidPayload: {
        patientId: PATIENT_ID,
        specialistEmail: "not-an-email",
        reasonForReferral: "Second opinion",
      },
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, letterId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get referral letter",
    },
    {
      handler: "update",
      params: { organisationId: ORG_ID, letterId: RECORD_ID },
      body: { examFindings: "Non-ambulatory paraparesis" },
      serviceMethod: "update",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        { examFindings: "Non-ambulatory paraparesis" },
      ],
      fallback: "Failed to update referral letter",
      invalidPayload: { reasonForReferral: "" },
    },
    {
      handler: "sign",
      params: { organisationId: ORG_ID, letterId: RECORD_ID },
      serviceMethod: "sign",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to sign referral letter",
    },
    {
      handler: "send",
      params: { organisationId: ORG_ID, letterId: RECORD_ID },
      serviceMethod: "send",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to send referral letter",
    },
    {
      handler: "cancel",
      params: { organisationId: ORG_ID, letterId: RECORD_ID },
      serviceMethod: "cancel",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to cancel referral letter",
    },
  ],
});
