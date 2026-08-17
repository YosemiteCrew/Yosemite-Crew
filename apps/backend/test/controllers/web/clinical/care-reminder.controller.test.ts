import { jest } from "@jest/globals";
import { CareReminderController } from "src/controllers/web/care-reminder.controller";
import {
  CareReminderService,
  CareReminderError,
} from "src/services/care-reminder.service";
import {
  ORG_ID,
  PATIENT_ID,
  RECORD_ID,
  SECOND_ID,
  USER_ID,
  runClinicalControllerSuite,
} from "./clinical-suite";

jest.mock("src/services/care-reminder.service", () => {
  const actual = jest.requireActual(
    "src/services/care-reminder.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    CareReminderService: {
      list: jest.fn(),
      create: jest.fn(),
      bulkCreate: jest.fn(),
      get: jest.fn(),
      send: jest.fn(),
      markResponded: jest.fn(),
      cancel: jest.fn(),
    },
  };
});

runClinicalControllerSuite({
  name: "CareReminderController",
  controller: CareReminderController,
  service: CareReminderService as unknown as Record<string, unknown>,
  errorClass: CareReminderError,
  cases: [
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      query: {
        patientId: PATIENT_ID,
        status: "PENDING",
        reminderType: "VACCINATION_BOOSTER",
        dueBefore: "2026-04-01T00:00:00.000Z",
        dueAfter: "2026-03-01T00:00:00.000Z",
      },
      serviceMethod: "list",
      expectArgs: [
        {
          organisationId: ORG_ID,
          patientId: PATIENT_ID,
          status: "PENDING",
          reminderType: "VACCINATION_BOOSTER",
          dueBefore: new Date("2026-04-01T00:00:00.000Z"),
          dueAfter: new Date("2026-03-01T00:00:00.000Z"),
        },
      ],
      fallback: "Failed to list care reminders",
      invalidPayload: { status: "SNOOZED" },
    },
    {
      handler: "list",
      params: { organisationId: ORG_ID },
      // Neither bound supplied: the date keys must be absent, not undefined.
      query: { reminderType: "DENTAL_CLEANING" },
      serviceMethod: "list",
      expectArgs: [{ organisationId: ORG_ID, reminderType: "DENTAL_CLEANING" }],
      fallback: "Failed to list care reminders",
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        reminderType: "ANNUAL_CHECKUP",
        dueDate: "2026-06-01T09:00:00.000Z",
        sendAt: "2026-05-25T09:00:00.000Z",
        notes: "Owner prefers morning slots",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          createdBy: USER_ID,
          patientId: PATIENT_ID,
          reminderType: "ANNUAL_CHECKUP",
          notes: "Owner prefers morning slots",
          dueDate: new Date("2026-06-01T09:00:00.000Z"),
          sendAt: new Date("2026-05-25T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create care reminder",
      invalidPayload: {
        patientId: PATIENT_ID,
        reminderType: "ANNUAL_CHECKUP",
        dueDate: "next June",
      },
    },
    {
      handler: "create",
      params: { organisationId: ORG_ID },
      body: {
        patientId: PATIENT_ID,
        reminderType: "CUSTOM",
        customMessage: "Bring the medication diary",
        dueDate: "2026-06-02T09:00:00.000Z",
      },
      serviceMethod: "create",
      expectArgs: [
        {
          organisationId: ORG_ID,
          createdBy: USER_ID,
          patientId: PATIENT_ID,
          reminderType: "CUSTOM",
          customMessage: "Bring the medication diary",
          dueDate: new Date("2026-06-02T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to create care reminder",
    },
    {
      handler: "bulkCreate",
      params: { organisationId: ORG_ID },
      body: {
        patientIds: [PATIENT_ID, SECOND_ID],
        reminderType: "PARASITE_TREATMENT",
        dueDate: "2026-07-01T09:00:00.000Z",
        sendAt: "2026-06-24T09:00:00.000Z",
      },
      serviceMethod: "bulkCreate",
      expectArgs: [
        {
          organisationId: ORG_ID,
          createdBy: USER_ID,
          patientIds: [PATIENT_ID, SECOND_ID],
          reminderType: "PARASITE_TREATMENT",
          dueDate: new Date("2026-07-01T09:00:00.000Z"),
          sendAt: new Date("2026-06-24T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to bulk create care reminders",
      // At least one patient is required.
      invalidPayload: {
        patientIds: [],
        reminderType: "PARASITE_TREATMENT",
        dueDate: "2026-07-01T09:00:00.000Z",
      },
    },
    {
      handler: "bulkCreate",
      params: { organisationId: ORG_ID },
      body: {
        patientIds: [PATIENT_ID],
        reminderType: "FOLLOW_UP",
        dueDate: "2026-07-02T09:00:00.000Z",
      },
      serviceMethod: "bulkCreate",
      expectArgs: [
        {
          organisationId: ORG_ID,
          createdBy: USER_ID,
          patientIds: [PATIENT_ID],
          reminderType: "FOLLOW_UP",
          dueDate: new Date("2026-07-02T09:00:00.000Z"),
        },
      ],
      status: 201,
      fallback: "Failed to bulk create care reminders",
    },
    {
      handler: "get",
      params: { organisationId: ORG_ID, reminderId: RECORD_ID },
      serviceMethod: "get",
      expectArgs: [RECORD_ID, ORG_ID],
      fallback: "Failed to get care reminder",
    },
    {
      handler: "send",
      params: { organisationId: ORG_ID, reminderId: RECORD_ID },
      serviceMethod: "send",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to send care reminder",
    },
    {
      handler: "markResponded",
      params: { organisationId: ORG_ID, reminderId: RECORD_ID },
      body: { appointmentId: SECOND_ID },
      serviceMethod: "markResponded",
      expectArgs: [RECORD_ID, ORG_ID, SECOND_ID, USER_ID],
      fallback: "Failed to mark reminder as responded",
      invalidPayload: { appointmentId: "not-a-uuid" },
    },
    {
      handler: "markResponded",
      params: { organisationId: ORG_ID, reminderId: RECORD_ID },
      // Responding without booking anything leaves the appointment undefined.
      body: {},
      serviceMethod: "markResponded",
      expectArgs: [RECORD_ID, ORG_ID, undefined, USER_ID],
      fallback: "Failed to mark reminder as responded",
    },
    {
      handler: "cancel",
      params: { organisationId: ORG_ID, reminderId: RECORD_ID },
      serviceMethod: "cancel",
      expectArgs: [RECORD_ID, ORG_ID, USER_ID],
      fallback: "Failed to cancel care reminder",
    },
  ],
});
