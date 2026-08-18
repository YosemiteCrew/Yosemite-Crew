import {
  CareReminderService,
  CareReminderError,
} from "src/services/care-reminder.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";
import { NotificationService } from "src/services/notification.service";
import { sendEmail } from "src/utils/email";

jest.mock("src/config/prisma", () => ({
  prisma: {
    careReminder: {
      create: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    patient: { findUnique: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
    parent: { findUnique: jest.fn() },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("src/services/notification.service", () => ({
  NotificationService: {
    sendToUser: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("src/utils/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

const pm = prisma as unknown as {
  careReminder: {
    create: jest.Mock;
    createMany: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  patient: { findUnique: jest.Mock };
  parentPatient: { findFirst: jest.Mock };
  parent: { findUnique: jest.Mock };
};

const DUE = new Date("2026-07-15T10:00:00Z");

const makeReminder = (over: Record<string, unknown> = {}) => ({
  id: "reminder-1",
  organisationId: "org-1",
  patientId: "pat-1",
  reminderType: "VACCINATION_BOOSTER",
  customMessage: null,
  dueDate: DUE,
  sendAt: null,
  status: "PENDING",
  sentAt: null,
  respondedAt: null,
  appointmentId: null,
  notes: null,
  createdBy: "vet-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  (NotificationService.sendToUser as jest.Mock).mockResolvedValue(undefined);
  (sendEmail as jest.Mock).mockResolvedValue(undefined);
  pm.careReminder.findFirst.mockResolvedValue(makeReminder());
  pm.careReminder.create.mockResolvedValue(makeReminder());
  pm.careReminder.createMany.mockResolvedValue({ count: 3 });
  pm.careReminder.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeReminder({ ...args.data })),
  );
  pm.careReminder.findMany.mockResolvedValue([makeReminder()]);
  pm.patient.findUnique.mockResolvedValue({ name: "Buddy" });
  pm.parentPatient.findFirst.mockResolvedValue({ parentId: "parent-1" });
  pm.parent.findUnique.mockResolvedValue({
    linkedUserId: "user-1",
    email: "owner@example.com",
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("CareReminderService.create", () => {
  it("creates a PENDING reminder", async () => {
    const result = await CareReminderService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      reminderType: "VACCINATION_BOOSTER",
      dueDate: DUE,
      createdBy: "vet-1",
    });
    expect(pm.careReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          reminderType: "VACCINATION_BOOSTER",
        }),
      }),
    );
    expect(result.status).toBe("PENDING");
  });

  it("stores custom message when provided", async () => {
    await CareReminderService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      reminderType: "CUSTOM",
      dueDate: DUE,
      customMessage: "Time for your annual check!",
    });
    expect(pm.careReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customMessage: "Time for your annual check!",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// bulkCreate
// ---------------------------------------------------------------------------

describe("CareReminderService.bulkCreate", () => {
  it("creates reminders for multiple patients", async () => {
    const result = await CareReminderService.bulkCreate({
      organisationId: "org-1",
      patientIds: ["pat-1", "pat-2", "pat-3"],
      reminderType: "ANNUAL_CHECKUP",
      dueDate: DUE,
    });
    expect(pm.careReminder.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            patientId: "pat-1",
            reminderType: "ANNUAL_CHECKUP",
          }),
        ]),
      }),
    );
    expect(result.created).toBe(3);
  });

  it("rejects empty patient list", async () => {
    await expect(
      CareReminderService.bulkCreate({
        organisationId: "org-1",
        patientIds: [],
        reminderType: "ANNUAL_CHECKUP",
        dueDate: DUE,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects patient list over 200", async () => {
    await expect(
      CareReminderService.bulkCreate({
        organisationId: "org-1",
        patientIds: Array.from({ length: 201 }, (_, i) => `pat-${i}`),
        reminderType: "ANNUAL_CHECKUP",
        dueDate: DUE,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("CareReminderService.get", () => {
  it("returns reminder by id and org", async () => {
    const result = await CareReminderService.get("reminder-1", "org-1");
    expect(result.id).toBe("reminder-1");
  });

  it("404s an unknown reminder", async () => {
    pm.careReminder.findFirst.mockResolvedValue(null);
    await expect(CareReminderService.get("bad", "org-1")).rejects.toMatchObject(
      { statusCode: 404 },
    );
  });
});

describe("CareReminderService.list", () => {
  it("lists all reminders for the org", async () => {
    const result = await CareReminderService.list({ organisationId: "org-1" });
    expect(result).toHaveLength(1);
  });

  it("filters by patient, status, type, and date range", async () => {
    const dueBefore = new Date("2026-08-01");
    const dueAfter = new Date("2026-07-01");
    await CareReminderService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "PENDING",
      reminderType: "VACCINATION_BOOSTER",
      dueBefore,
      dueAfter,
    });
    expect(pm.careReminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          status: "PENDING",
          reminderType: "VACCINATION_BOOSTER",
          dueDate: { lte: dueBefore, gte: dueAfter },
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// send
// ---------------------------------------------------------------------------

describe("CareReminderService.send", () => {
  it("dispatches push and email, transitions to SENT", async () => {
    const result = await CareReminderService.send(
      "reminder-1",
      "org-1",
      "vet-1",
    );
    expect(NotificationService.sendToUser).toHaveBeenCalledWith(
      "user-1",
      expect.any(Object),
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.com" }),
    );
    expect(pm.careReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CARE_REMINDER_SENT",
        actorId: "vet-1",
      }),
    );
    expect(result.status).toBe("SENT");
  });

  it("sends without push when no owner userId", async () => {
    pm.parent.findUnique.mockResolvedValue({
      linkedUserId: null,
      email: "owner@example.com",
    });
    await CareReminderService.send("reminder-1", "org-1");
    expect(NotificationService.sendToUser).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
  });

  it("sends without email when no owner email", async () => {
    pm.parent.findUnique.mockResolvedValue({
      linkedUserId: "user-1",
      email: null,
    });
    await CareReminderService.send("reminder-1", "org-1");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(NotificationService.sendToUser).toHaveBeenCalled();
  });

  it("still transitions to SENT when no parent found", async () => {
    pm.parentPatient.findFirst.mockResolvedValue(null);
    const result = await CareReminderService.send("reminder-1", "org-1");
    expect(result.status).toBe("SENT");
  });

  it("rejects sending a non-PENDING reminder", async () => {
    pm.careReminder.findFirst.mockResolvedValue(
      makeReminder({ status: "SENT" }),
    );
    await expect(
      CareReminderService.send("reminder-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ---------------------------------------------------------------------------
// markResponded
// ---------------------------------------------------------------------------

describe("CareReminderService.markResponded", () => {
  it("marks SENT reminder as RESPONDED with appointmentId", async () => {
    pm.careReminder.findFirst.mockResolvedValue(
      makeReminder({ status: "SENT" }),
    );
    const result = await CareReminderService.markResponded(
      "reminder-1",
      "org-1",
      "appt-1",
      "vet-1",
    );
    expect(pm.careReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RESPONDED",
          appointmentId: "appt-1",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "CARE_REMINDER_RESPONDED" }),
    );
    expect(result.status).toBe("RESPONDED");
  });

  it("allows marking PENDING as RESPONDED", async () => {
    await CareReminderService.markResponded("reminder-1", "org-1");
    expect(pm.careReminder.update).toHaveBeenCalled();
  });

  it("rejects marking an EXPIRED reminder as responded", async () => {
    pm.careReminder.findFirst.mockResolvedValue(
      makeReminder({ status: "EXPIRED" }),
    );
    await expect(
      CareReminderService.markResponded("reminder-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ---------------------------------------------------------------------------
// cancel
// ---------------------------------------------------------------------------

describe("CareReminderService.cancel", () => {
  it("cancels a PENDING reminder and emits audit", async () => {
    const result = await CareReminderService.cancel(
      "reminder-1",
      "org-1",
      "vet-1",
    );
    expect(pm.careReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "CARE_REMINDER_CANCELLED" }),
    );
    expect(result.status).toBe("CANCELLED");
  });

  it("rejects cancelling an already-cancelled reminder", async () => {
    pm.careReminder.findFirst.mockResolvedValue(
      makeReminder({ status: "CANCELLED" }),
    );
    await expect(
      CareReminderService.cancel("reminder-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects cancelling a RESPONDED reminder", async () => {
    pm.careReminder.findFirst.mockResolvedValue(
      makeReminder({ status: "RESPONDED" }),
    );
    await expect(
      CareReminderService.cancel("reminder-1", "org-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
