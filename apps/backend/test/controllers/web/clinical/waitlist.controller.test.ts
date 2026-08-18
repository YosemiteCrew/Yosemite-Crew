import { jest } from "@jest/globals";
import { WaitlistController } from "src/controllers/web/waitlist.controller";
import { WaitlistService, WaitlistError } from "src/services/waitlist.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/waitlist.service", () => {
  const actual = jest.requireActual("src/services/waitlist.service") as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    WaitlistService: {
      list: jest.fn(),
      add: jest.fn(),
      get: jest.fn(),
      offer: jest.fn(),
      book: jest.fn(),
      cancel: jest.fn(),
      expireStale: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "WaitlistController",
  controller: WaitlistController,
  service: WaitlistService as unknown as Record<string, unknown>,
  errorClass: WaitlistError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        status: "WAITING",
        patientId: PATIENT_ID,
        appointmentType: "Consultation",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          status: "WAITING",
          patientId: PATIENT_ID,
          appointmentType: "Consultation",
        },
      ],
      fallback: "Failed to list waitlist entries",
      invalidPayload: { status: "QUEUED" },
    },
    {
      handler: "add",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        preferredLeadId: SECOND_ID,
        appointmentType: "Consultation",
        earliestDate: "2026-04-05T09:00:00.000Z",
        latestDate: "2026-04-12T17:00:00.000Z",
        expiresAt: "2026-04-13T00:00:00.000Z",
        notes: "Owner can come at short notice",
      },
      serviceMethod: "add",
      expectArgs: [
        {
          organisationId: ORG_ID,
          requestedBy: USER_ID,
          patientId: PATIENT_ID,
          preferredLeadId: SECOND_ID,
          appointmentType: "Consultation",
          notes: "Owner can come at short notice",
          earliestDate: new Date("2026-04-05T09:00:00.000Z"),
          latestDate: new Date("2026-04-12T17:00:00.000Z"),
          expiresAt: new Date("2026-04-13T00:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to add waitlist entry",
      invalidPayload: { patientId: PATIENT_ID, preferredLeadId: "not-a-uuid" },
    },
    {
      handler: "add",
      params: { organisationId: ORG_ID },
      // No window given: all three dates resolve to undefined.
      body: { patientId: PATIENT_ID },
      serviceMethod: "add",
      expectArgs: [
        {
          organisationId: ORG_ID,
          requestedBy: USER_ID,
          patientId: PATIENT_ID,
          earliestDate: undefined,
          latestDate: undefined,
          expiresAt: undefined,
        },
      ],
      status: 201,
      fallback: "Failed to add waitlist entry",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, entryId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get waitlist entry",
    },
    {
      handler: "offer",
      params: { organisationId: ORG_ID, entryId: RECORD_ID },
      serviceMethod: "offer",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to offer slot",
    },
    {
      handler: "book",
      params: { organisationId: ORG_ID, entryId: RECORD_ID },
      serviceMethod: "book",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to book waitlist entry",
    },
    {
      handler: "cancel",
      params: { organisationId: ORG_ID, entryId: RECORD_ID },
      serviceMethod: "cancel",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to cancel waitlist entry",
    },
    {
      handler: "expireStale",
      params: { organisationId: ORG_ID },
      serviceMethod: "expireStale",
      expectArgs: [ORG_ID],
      fallback: "Failed to expire stale entries",
    },
  ],
});
