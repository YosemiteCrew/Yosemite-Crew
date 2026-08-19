import { jest } from "@jest/globals";
import { BloodBankController } from "src/controllers/web/blood-bank.controller";
import {
  BloodBankService,
  BloodBankError,
} from "src/services/blood-bank.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/blood-bank.service", () => {
  const actual = jest.requireActual(
    "src/services/blood-bank.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    BloodBankService: {
      listDonors: jest.fn(),
      registerDonor: jest.fn(),
      getDonor: jest.fn(),
      updateDonor: jest.fn(),
      listDonations: jest.fn(),
      recordDonation: jest.fn(),
      getDonation: jest.fn(),
      updateDonation: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "BloodBankController",
  controller: BloodBankController,
  service: BloodBankService as unknown as Record<string, unknown>,
  errorClass: BloodBankError,
  cases: [
    {
      handler: "listDonors",
      params: { organisationId: ORG_ID },
      query: { bloodType: "DEA_1_NEGATIVE", isActive: "true" },
      serviceMethod: "listDonors",
      expectArgs: [
        {
          organisationId: ORG_ID,
          bloodType: "DEA_1_NEGATIVE",
          isActive: true,
        },
      ],
      fallback: "Failed to list blood donors",
      invalidPayload: { bloodType: "TYPE_Z" },
    },
    {
      handler: "listDonors",
      params: { organisationId: ORG_ID },
      // "false" and anything else must map to false / undefined respectively.
      query: { isActive: "false" },
      serviceMethod: "listDonors",
      expectArgs: [
        { organisationId: ORG_ID, bloodType: undefined, isActive: false },
      ],
      fallback: "Failed to list blood donors",
    },
    {
      handler: "listDonors",
      params: { organisationId: ORG_ID },
      query: { isActive: "maybe" },
      serviceMethod: "listDonors",
      expectArgs: [
        { organisationId: ORG_ID, bloodType: undefined, isActive: undefined },
      ],
      fallback: "Failed to list blood donors",
    },
    {
      handler: "registerDonor",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        bloodType: "DEA_1_POSITIVE",
        lastScreeningAt: "2026-01-10T09:00:00.000Z",
        isActive: true,
      },
      serviceMethod: "registerDonor",
      expectArgs: [
        {
          organisationId: ORG_ID,
          registeredBy: USER_ID,
          patientId: PATIENT_ID,
          bloodType: "DEA_1_POSITIVE",
          isActive: true,
          lastScreeningAt: new Date("2026-01-10T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to register blood donor",
      invalidPayload: { patientId: "not-a-uuid", bloodType: "TYPE_A" },
    },
    {
      handler: "registerDonor",
      params: { organisationId: ORG_ID },
      body: { patientId: PATIENT_ID, bloodType: "UNKNOWN" },
      serviceMethod: "registerDonor",
      expectArgs: [
        {
          organisationId: ORG_ID,
          registeredBy: USER_ID,
          patientId: PATIENT_ID,
          bloodType: "UNKNOWN",
          lastScreeningAt: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to register blood donor",
    },
    {
      handler: "getDonor",
      params: { organisationId: ORG_ID, donorId: RECORD_ID },
      serviceMethod: "getDonor",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get blood donor",
    },
    {
      handler: "updateDonor",
      params: { organisationId: ORG_ID, donorId: RECORD_ID },
      body: {
        bloodType: "TYPE_B",
        lastScreeningAt: "2026-02-01T09:00:00.000Z",
        lastDonationAt: "2026-02-02T09:00:00.000Z",
        nextEligibleAt: "2026-04-02T09:00:00.000Z",
        totalDonations: 4,
      },
      serviceMethod: "updateDonor",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          bloodType: "TYPE_B",
          totalDonations: 4,
          lastScreeningAt: new Date("2026-02-01T09:00:00.000Z"),
          lastDonationAt: new Date("2026-02-02T09:00:00.000Z"),
          nextEligibleAt: new Date("2026-04-02T09:00:00.000Z"),
        },
      ],
      fallback: "Failed to update blood donor",
      invalidPayload: { totalDonations: -3 },
    },
    {
      handler: "updateDonor",
      params: { organisationId: ORG_ID, donorId: RECORD_ID },
      body: { disqualificationReason: "Positive screening" },
      serviceMethod: "updateDonor",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          disqualificationReason: "Positive screening",
          lastScreeningAt: undefined,
          lastDonationAt: undefined,
          nextEligibleAt: undefined,
        },
      ],
      fallback: "Failed to update blood donor",
    },
    {
      handler: "listDonations",
      params: { organisationId: ORG_ID },
      query: { donorId: RECORD_ID, status: "AVAILABLE" },
      serviceMethod: "listDonations",
      expectArgs: [
        { organisationId: ORG_ID, donorId: RECORD_ID, status: "AVAILABLE" },
      ],
      fallback: "Failed to list blood donations",
      invalidPayload: { status: "SPILLED" },
    },
    {
      handler: "recordDonation",
      params: { organisationId: ORG_ID },
      body: {
        donorId: RECORD_ID,
        collectedAt: "2026-02-14T08:00:00.000Z",
        volumeMl: 450,
        unitId: "UNIT-7",
        expiresAt: "2026-03-21T08:00:00.000Z",
        crossmatchResults: [{ recipientId: "rec-1", compatible: true }],
      },
      serviceMethod: "recordDonation",
      expectArgs: [
        {
          organisationId: ORG_ID,
          collectedBy: USER_ID,
          donorId: RECORD_ID,
          volumeMl: 450,
          unitId: "UNIT-7",
          crossmatchResults: [{ recipientId: "rec-1", compatible: true }],
          collectedAt: new Date("2026-02-14T08:00:00.000Z"),
          expiresAt: new Date("2026-03-21T08:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to record blood donation",
      // volumeMl must be positive.
      invalidPayload: {
        donorId: RECORD_ID,
        collectedAt: "2026-02-14T08:00:00.000Z",
        volumeMl: 0,
      },
    },
    {
      handler: "recordDonation",
      params: { organisationId: ORG_ID },
      body: {
        donorId: SECOND_ID,
        collectedAt: "2026-02-15T08:00:00.000Z",
        volumeMl: 200,
      },
      serviceMethod: "recordDonation",
      expectArgs: [
        {
          organisationId: ORG_ID,
          collectedBy: USER_ID,
          donorId: SECOND_ID,
          volumeMl: 200,
          collectedAt: new Date("2026-02-15T08:00:00.000Z"),
          expiresAt: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to record blood donation",
    },
    {
      handler: "getDonation",
      params: { organisationId: ORG_ID, donationId: RECORD_ID },
      serviceMethod: "getDonation",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get blood donation",
    },
    {
      handler: "updateDonation",
      params: { organisationId: ORG_ID, donationId: RECORD_ID },
      body: {
        status: "TRANSFUSED",
        crossmatchResults: [
          {
            recipientId: "rec-2",
            compatible: false,
            testedAt: "2026-02-16T08:00:00.000Z",
          },
        ],
      },
      serviceMethod: "updateDonation",
      expectArgs: [
        RECORD_ID,
        ORG_ID,
        {
          status: "TRANSFUSED",
          crossmatchResults: [
            {
              recipientId: "rec-2",
              compatible: false,
              testedAt: "2026-02-16T08:00:00.000Z",
            },
          ],
        },
      ],
      fallback: "Failed to update blood donation",
      invalidPayload: { status: "TRANSFUSED", crossmatchResults: [{}] },
    },
  ],
});
