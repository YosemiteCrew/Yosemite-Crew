const mockPrisma = {
  careReminder: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  patient: { findUnique: jest.fn() },
  parentPatient: { findFirst: jest.fn() },
  parent: { findUnique: jest.fn() },
  notification: { findFirst: jest.fn() },
};

jest.mock("src/config/prisma", () => ({ prisma: mockPrisma }));
jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));
jest.mock("src/services/notification.service", () => ({
  NotificationService: { sendToUser: jest.fn() },
}));
jest.mock("src/utils/notificationTemplates", () => ({
  NotificationTemplates: { Care: { CARE_REMINDER: jest.fn(() => ({})) } },
}));
jest.mock("src/utils/email", () => ({ sendEmail: jest.fn() }));
jest.mock("src/services/care-reminder-opt-out.service", () => ({
  resolveCareReminderSuppression: jest
    .fn()
    .mockResolvedValue({ email: false, push: false }),
  buildCareReminderUnsubscribeUrl: jest.fn(
    () => "https://clinic.example/unsubscribe",
  ),
}));
jest.mock("src/services/shared/patient-org-membership", () => ({
  assertPatientOrgMembership: jest.fn(),
  assertPatientsOrgMembership: jest.fn(),
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  CareReminderService,
  CareReminderError,
} from "../../src/services/care-reminder.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { NotificationService } from "../../src/services/notification.service";
import { sendEmail } from "../../src/utils/email";
import logger from "../../src/utils/logger";
import { Prisma } from "@prisma/client";
import { resolveCareReminderSuppression } from "../../src/services/care-reminder-opt-out.service";

const pendingReminder = {
  id: "00000000-0000-4000-8000-000000000001",
  organisationId: "00000000-0000-4000-8000-000000000002",
  patientId: "patient-1",
  reminderType: "ANNUAL_CHECKUP",
  customMessage: null,
  dueDate: new Date("2026-09-01T00:00:00Z"),
  status: "PENDING",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.careReminder.findFirst.mockResolvedValue(pendingReminder);
  mockPrisma.careReminder.findMany.mockResolvedValue([]);
  mockPrisma.careReminder.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.patient.findUnique.mockResolvedValue({ name: "Milo" });
  mockPrisma.parentPatient.findFirst.mockResolvedValue({
    parentId: "parent-1",
  });
  mockPrisma.parent.findUnique.mockResolvedValue({
    linkedUserId: "user-1",
    email: "owner@example.test",
  });
  (NotificationService.sendToUser as jest.Mock).mockResolvedValue([
    { success: true },
  ]);
  (sendEmail as jest.Mock).mockResolvedValue(undefined);
  mockPrisma.careReminder.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...pendingReminder,
      ...data,
    }),
  );
});

describe("CareReminderService.send", () => {
  it("rejects invalid reminder scope before querying the database", async () => {
    await expect(CareReminderService.send("", "")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockPrisma.careReminder.findFirst).not.toHaveBeenCalled();
  });

  it("atomically claims a reminder and persists each channel outcome", async () => {
    const result = await CareReminderService.send(
      pendingReminder.id,
      pendingReminder.organisationId,
      "staff-1",
    );

    expect(mockPrisma.careReminder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: pendingReminder.id,
          organisationId: pendingReminder.organisationId,
          status: "PENDING",
        },
        data: expect.objectContaining({
          status: "SENDING",
          sendingAt: expect.any(Date),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: "SENT",
        lastDelivery: { push: "delivered", email: "delivered" },
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CARE_REMINDER_DELIVERY_ATTEMPT",
        metadata: expect.objectContaining({
          delivery: { push: "delivered", email: "delivered" },
        }),
      }),
    );
  });

  it("does not send a reminder that has already left the pending state", async () => {
    mockPrisma.careReminder.findFirst.mockResolvedValueOnce({
      ...pendingReminder,
      status: "SENT",
    });

    await expect(
      CareReminderService.send(
        pendingReminder.id,
        pendingReminder.organisationId,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.careReminder.updateMany).not.toHaveBeenCalled();
  });

  it("keeps a reminder pending with a visible failed result when no channel delivers", async () => {
    (NotificationService.sendToUser as jest.Mock).mockResolvedValue([
      { success: false },
    ]);
    (sendEmail as jest.Mock).mockRejectedValue(new Error("mail unavailable"));

    const result = await CareReminderService.send(
      pendingReminder.id,
      pendingReminder.organisationId,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "PENDING",
        lastDelivery: { push: "failed", email: "failed" },
      }),
    );
    expect(mockPrisma.careReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", sendingAt: null }),
      }),
    );
  });

  it("marks the reminder delivered when email succeeds even if push fails", async () => {
    (NotificationService.sendToUser as jest.Mock).mockResolvedValue([
      { success: false },
    ]);

    const result = await CareReminderService.send(
      pendingReminder.id,
      pendingReminder.organisationId,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "SENT",
        lastDelivery: { push: "failed", email: "delivered" },
      }),
    );
  });

  it("persists unreachable outcomes when no primary owner is linked", async () => {
    mockPrisma.patient.findUnique.mockResolvedValueOnce(null);
    mockPrisma.parentPatient.findFirst.mockResolvedValueOnce(null);

    const result = await CareReminderService.send(
      pendingReminder.id,
      pendingReminder.organisationId,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "PENDING",
        lastDelivery: { push: "unreachable", email: "unreachable" },
      }),
    );
    expect(NotificationService.sendToUser).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not dispatch if another request already claimed the reminder", async () => {
    mockPrisma.careReminder.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      CareReminderService.send(
        pendingReminder.id,
        pendingReminder.organisationId,
      ),
    ).rejects.toBeInstanceOf(CareReminderError);
    expect(NotificationService.sendToUser).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("releases the claim and records a failed attempt when preferences cannot be checked", async () => {
    (resolveCareReminderSuppression as jest.Mock).mockRejectedValueOnce(
      new Error("store unavailable"),
    );

    await expect(
      CareReminderService.send(
        pendingReminder.id,
        pendingReminder.organisationId,
      ),
    ).rejects.toMatchObject({ statusCode: 503 });

    expect(mockPrisma.careReminder.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: pendingReminder.id,
          organisationId: pendingReminder.organisationId,
          status: "SENDING",
        },
        data: expect.objectContaining({ status: "PENDING", sendingAt: null }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CARE_REMINDER_DELIVERY_ATTEMPT",
        metadata: {
          reminderType: "ANNUAL_CHECKUP",
          delivery: { push: "failed", email: "failed" },
        },
      }),
    );
  });

  it("does not cancel a reminder while delivery is in progress", async () => {
    mockPrisma.careReminder.findFirst.mockResolvedValueOnce({
      ...pendingReminder,
      status: "SENDING",
    });

    await expect(
      CareReminderService.cancel(
        pendingReminder.id,
        pendingReminder.organisationId,
      ),
    ).rejects.toBeInstanceOf(CareReminderError);
    expect(mockPrisma.careReminder.update).not.toHaveBeenCalled();
  });
});

describe("CareReminderService.sendScheduledDue", () => {
  it("processes each due reminder once and continues after a send failure", async () => {
    mockPrisma.careReminder.findMany.mockResolvedValue([
      { id: "one", organisationId: "org-1" },
      { id: "two", organisationId: "org-2" },
    ]);
    const send = jest
      .spyOn(CareReminderService, "send")
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("transient"));

    await expect(CareReminderService.sendScheduledDue()).resolves.toBe(2);

    expect(mockPrisma.careReminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          lastAttemptAt: null,
        }),
        take: 100,
      }),
    );
    expect(send).toHaveBeenNthCalledWith(1, "one", "org-1");
    expect(send).toHaveBeenNthCalledWith(2, "two", "org-2");
    expect(logger.error).toHaveBeenCalled();
    send.mockRestore();
  });

  it("only picks send times inside the last week", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-30T12:00:00Z") });
    try {
      await CareReminderService.sendScheduledDue();
    } finally {
      jest.useRealTimers();
    }

    expect(mockPrisma.careReminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sendAt: {
            lte: new Date("2026-09-30T12:00:00Z"),
            gte: new Date("2026-09-23T12:00:00Z"),
          },
        }),
      }),
    );
  });

  it("returns an abandoned send claim to pending without a result before picking due reminders", async () => {
    jest.useFakeTimers({ now: new Date("2026-09-30T12:00:00Z") });
    try {
      await CareReminderService.sendScheduledDue();
    } finally {
      jest.useRealTimers();
    }

    expect(mockPrisma.careReminder.updateMany).toHaveBeenCalledWith({
      where: {
        status: "SENDING",
        sendingAt: { lt: new Date("2026-09-30T11:45:00Z") },
      },
      data: { status: "PENDING", sendingAt: null, lastDelivery: Prisma.DbNull },
    });
    expect(
      mockPrisma.careReminder.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockPrisma.careReminder.findMany.mock.invocationCallOrder[0],
    );
  });

  it("records a scheduled send as a system action", async () => {
    await CareReminderService.send(
      pendingReminder.id,
      pendingReminder.organisationId,
    );

    const actors = (AuditTrailService.recordSafely as jest.Mock).mock.calls.map(
      ([entry]) => entry.actorType,
    );
    expect(actors).toEqual(["SYSTEM", "SYSTEM"]);
  });
});

it("records a staff send against the staff member", async () => {
  await CareReminderService.send(
    pendingReminder.id,
    pendingReminder.organisationId,
    "staff-1",
  );

  expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
    expect.objectContaining({ actorType: "PMS_USER", actorId: "staff-1" }),
  );
});
