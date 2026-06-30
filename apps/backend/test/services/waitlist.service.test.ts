import { WaitlistService, WaitlistError } from "src/services/waitlist.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";
import { NotificationService } from "src/services/notification.service";
import { sendEmail } from "src/utils/email";
import logger from "src/utils/logger";

jest.mock("src/config/prisma", () => ({
  prisma: {
    waitlistEntry: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    parentPatient: { findFirst: jest.fn() },
    parent: { findUnique: jest.fn() },
    patient: { findUnique: jest.fn() },
    appointment: { findUnique: jest.fn() },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("src/services/notification.service", () => ({
  NotificationService: { sendToUser: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("src/utils/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

const pm = prisma as unknown as {
  waitlistEntry: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  parentPatient: { findFirst: jest.Mock };
  parent: { findUnique: jest.Mock };
  patient: { findUnique: jest.Mock };
  appointment: { findUnique: jest.Mock };
};

const makeEntry = (over: Record<string, unknown> = {}) => ({
  id: "entry-1",
  organisationId: "org-1",
  patientId: "pat-1",
  requestedBy: "vet-1",
  preferredLeadId: null,
  appointmentType: "WELLNESS",
  earliestDate: null,
  latestDate: null,
  notes: null,
  status: "WAITING",
  offeredAt: null,
  bookedAt: null,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  (NotificationService.sendToUser as jest.Mock).mockResolvedValue(undefined);
  (sendEmail as jest.Mock).mockResolvedValue(undefined);
  pm.waitlistEntry.findFirst.mockResolvedValue(makeEntry());
  pm.waitlistEntry.create.mockResolvedValue(makeEntry());
  pm.waitlistEntry.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeEntry({ ...args.data })),
  );
  pm.waitlistEntry.findMany.mockResolvedValue([makeEntry()]);
  pm.waitlistEntry.updateMany.mockResolvedValue({ count: 0 });
  pm.parentPatient.findFirst.mockResolvedValue(null);
  pm.parent.findUnique.mockResolvedValue(null);
  pm.patient.findUnique.mockResolvedValue({ name: "Buddy" });
  pm.appointment.findUnique.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

describe("WaitlistService.add", () => {
  it("creates a waitlist entry with WAITING status", async () => {
    const result = await WaitlistService.add({
      organisationId: "org-1",
      patientId: "pat-1",
      requestedBy: "vet-1",
      appointmentType: "WELLNESS",
    });
    expect(pm.waitlistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: "org-1",
          patientId: "pat-1",
          status: "WAITING",
        }),
      }),
    );
    expect(result.id).toBe("entry-1");
  });

  it("emits WAITLIST_ENTRY_ADDED audit event", async () => {
    await WaitlistService.add({ organisationId: "org-1", patientId: "pat-1" });
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "WAITLIST_ENTRY_ADDED",
        patientId: "pat-1",
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("WaitlistService.get", () => {
  it("returns an entry by id and org", async () => {
    const result = await WaitlistService.get("entry-1", "org-1");
    expect(result.id).toBe("entry-1");
  });

  it("404s a missing entry", async () => {
    pm.waitlistEntry.findFirst.mockResolvedValue(null);
    await expect(WaitlistService.get("bad", "org-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("WaitlistService.list", () => {
  it("returns entries for the org", async () => {
    const result = await WaitlistService.list({ organisationId: "org-1" });
    expect(result).toHaveLength(1);
  });

  it("filters by status and patientId", async () => {
    await WaitlistService.list({
      organisationId: "org-1",
      status: "WAITING",
      patientId: "pat-1",
    });
    expect(pm.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "WAITING",
          patientId: "pat-1",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// offer
// ---------------------------------------------------------------------------

describe("WaitlistService.offer", () => {
  it("transitions WAITING to OFFERED", async () => {
    const result = await WaitlistService.offer("entry-1", "org-1", "vet-1");
    expect(pm.waitlistEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "OFFERED" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "WAITLIST_ENTRY_OFFERED" }),
    );
    expect(result.status).toBe("OFFERED");
  });

  it("rejects if not in WAITING status", async () => {
    pm.waitlistEntry.findFirst.mockResolvedValue(
      makeEntry({ status: "BOOKED" }),
    );
    await expect(
      WaitlistService.offer("entry-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("sends push notification to the owner", async () => {
    pm.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    pm.parent.findUnique.mockResolvedValue({
      linkedUserId: "user-1",
      email: null,
    });
    pm.patient.findUnique.mockResolvedValue({ name: "Buddy" });

    await WaitlistService.offer("entry-1", "org-1", "vet-1");
    await new Promise((r) => setImmediate(r));

    expect(NotificationService.sendToUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Appointment slot available" }),
    );
  });

  it("sends email if owner has no linkedUserId but has email", async () => {
    pm.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    pm.parent.findUnique.mockResolvedValue({
      linkedUserId: null,
      email: "owner@test.com",
    });
    pm.patient.findUnique.mockResolvedValue({ name: "Buddy" });

    await WaitlistService.offer("entry-1", "org-1");
    await new Promise((r) => setImmediate(r));

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@test.com" }),
    );
  });
});

// ---------------------------------------------------------------------------
// book
// ---------------------------------------------------------------------------

describe("WaitlistService.book", () => {
  it("transitions WAITING to BOOKED", async () => {
    await WaitlistService.book("entry-1", "org-1", "vet-1");
    expect(pm.waitlistEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "BOOKED" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "WAITLIST_ENTRY_BOOKED" }),
    );
  });

  it("transitions OFFERED to BOOKED", async () => {
    pm.waitlistEntry.findFirst.mockResolvedValue(
      makeEntry({ status: "OFFERED" }),
    );
    await WaitlistService.book("entry-1", "org-1");
    expect(pm.waitlistEntry.update).toHaveBeenCalled();
  });

  it("rejects a CANCELLED entry", async () => {
    pm.waitlistEntry.findFirst.mockResolvedValue(
      makeEntry({ status: "CANCELLED" }),
    );
    await expect(
      WaitlistService.book("entry-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

// ---------------------------------------------------------------------------
// cancel
// ---------------------------------------------------------------------------

describe("WaitlistService.cancel", () => {
  it("transitions to CANCELLED", async () => {
    await WaitlistService.cancel("entry-1", "org-1", "vet-1");
    expect(pm.waitlistEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "WAITLIST_ENTRY_CANCELLED" }),
    );
  });

  it("rejects already-cancelled entries", async () => {
    pm.waitlistEntry.findFirst.mockResolvedValue(
      makeEntry({ status: "CANCELLED" }),
    );
    await expect(
      WaitlistService.cancel("entry-1", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

// ---------------------------------------------------------------------------
// expireStale
// ---------------------------------------------------------------------------

describe("WaitlistService.expireStale", () => {
  it("bulk-expires WAITING entries past their expiresAt", async () => {
    pm.waitlistEntry.updateMany.mockResolvedValue({ count: 3 });
    const result = await WaitlistService.expireStale("org-1");
    expect(result.expired).toBe(3);
    expect(pm.waitlistEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "EXPIRED" } }),
    );
  });
});

// ---------------------------------------------------------------------------
// notifyOnCancellation
// ---------------------------------------------------------------------------

describe("WaitlistService.notifyOnCancellation", () => {
  const appointment = {
    organisationId: "org-1",
    appointmentDate: new Date("2026-07-15T10:00:00.000Z"),
    appointmentType: "WELLNESS",
    status: "CANCELLED",
  };

  it("does nothing when appointment is not found", async () => {
    pm.appointment.findUnique.mockResolvedValue(null);
    await WaitlistService.notifyOnCancellation("appt-1");
    expect(pm.waitlistEntry.findMany).not.toHaveBeenCalled();
  });

  it("does nothing when appointment is not CANCELLED", async () => {
    pm.appointment.findUnique.mockResolvedValue({
      ...appointment,
      status: "COMPLETED",
    });
    await WaitlistService.notifyOnCancellation("appt-1");
    expect(pm.waitlistEntry.findMany).not.toHaveBeenCalled();
  });

  it("offers and notifies up to 5 WAITING entries", async () => {
    pm.appointment.findUnique.mockResolvedValue(appointment);
    const entries = [makeEntry(), makeEntry({ id: "entry-2" })];
    pm.waitlistEntry.findMany.mockResolvedValue(entries);
    pm.waitlistEntry.update.mockResolvedValue({});

    const result = await WaitlistService.notifyOnCancellation("appt-1");
    expect(pm.waitlistEntry.update).toHaveBeenCalledTimes(2);
    expect(AuditTrailService.recordSafely).toHaveBeenCalledTimes(2);
    expect(result?.notified).toBe(2);
  });
});
