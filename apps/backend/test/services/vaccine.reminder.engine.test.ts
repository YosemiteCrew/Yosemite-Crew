import { VaccineReminderEngine } from "src/services/vaccine.reminder.engine";
import { prisma } from "src/config/prisma";
import { NotificationService } from "src/services/notification.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    immunization: { findMany: jest.fn(), update: jest.fn() },
    encounter: { findUnique: jest.fn() },
    patient: { findUnique: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
    parent: { findUnique: jest.fn() },
  },
}));

jest.mock("src/services/notification.service", () => ({
  NotificationService: { sendToUser: jest.fn() },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mocked = prisma as unknown as {
  immunization: { findMany: jest.Mock; update: jest.Mock };
  encounter: { findUnique: jest.Mock };
  patient: { findUnique: jest.Mock };
  parentPatient: { findFirst: jest.Mock };
  parent: { findUnique: jest.Mock };
};
const mockedSend = NotificationService.sendToUser as jest.Mock;

const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

const immunizationRow = (overrides: Record<string, unknown> = {}) => ({
  id: "imm-1",
  nextDueDate: dueDate,
  metadata: null,
  artifact: { encounterId: "enc-1" },
  ...overrides,
});

const wireOwner = () => {
  mocked.encounter.findUnique.mockResolvedValue({ patientId: "pat-1" });
  mocked.patient.findUnique.mockResolvedValue({ name: "Biscuit" });
  mocked.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
  mocked.parent.findUnique.mockResolvedValue({ linkedUserId: "user-1" });
};

describe("VaccineReminderEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSend.mockResolvedValue([]);
    mocked.immunization.update.mockResolvedValue({});
  });

  it("reminds the owner of a due vaccination and records the send", async () => {
    mocked.immunization.findMany.mockResolvedValue([immunizationRow()]);
    wireOwner();

    await VaccineReminderEngine.run();

    expect(mocked.immunization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          artifact: { status: "SIGNED" },
          nextDueDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
    expect(mockedSend).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Vaccination Due 🩺" }),
    );
    expect(mocked.immunization.update).toHaveBeenCalledWith({
      where: { id: "imm-1" },
      data: {
        metadata: {
          vaccineReminder: { sentForDueDate: dueDate.toISOString() },
        },
      },
    });
  });

  it("preserves existing metadata when recording the send", async () => {
    mocked.immunization.findMany.mockResolvedValue([
      immunizationRow({ metadata: { source: "encounter" } }),
    ]);
    wireOwner();

    await VaccineReminderEngine.run();

    expect(mocked.immunization.update).toHaveBeenCalledWith({
      where: { id: "imm-1" },
      data: {
        metadata: {
          source: "encounter",
          vaccineReminder: { sentForDueDate: dueDate.toISOString() },
        },
      },
    });
  });

  it("skips a record already reminded for the same due date", async () => {
    mocked.immunization.findMany.mockResolvedValue([
      immunizationRow({
        metadata: {
          vaccineReminder: { sentForDueDate: dueDate.toISOString() },
        },
      }),
    ]);

    await VaccineReminderEngine.run();

    expect(mockedSend).not.toHaveBeenCalled();
    expect(mocked.immunization.update).not.toHaveBeenCalled();
  });

  it("skips records with no due date or no encounter", async () => {
    mocked.immunization.findMany.mockResolvedValue([
      immunizationRow({ id: "imm-no-due", nextDueDate: null }),
      immunizationRow({ id: "imm-no-enc", artifact: { encounterId: null } }),
    ]);

    await VaccineReminderEngine.run();

    expect(mocked.encounter.findUnique).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("skips when the encounter, patient, or owner cannot be resolved", async () => {
    mocked.immunization.findMany.mockResolvedValue([immunizationRow()]);

    mocked.encounter.findUnique.mockResolvedValueOnce(null);
    await VaccineReminderEngine.run();

    mocked.encounter.findUnique.mockResolvedValue({ patientId: "pat-1" });
    mocked.patient.findUnique.mockResolvedValueOnce(null);
    await VaccineReminderEngine.run();

    mocked.patient.findUnique.mockResolvedValue({ name: "Biscuit" });
    mocked.parentPatient.findFirst.mockResolvedValueOnce(null);
    await VaccineReminderEngine.run();

    mocked.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
    mocked.parent.findUnique.mockResolvedValueOnce({ linkedUserId: null });
    await VaccineReminderEngine.run();

    expect(mockedSend).not.toHaveBeenCalled();
    expect(mocked.immunization.update).not.toHaveBeenCalled();
  });

  it("logs and continues when a reminder fails to send", async () => {
    mocked.immunization.findMany.mockResolvedValue([
      immunizationRow({ id: "imm-a" }),
      immunizationRow({ id: "imm-b" }),
    ]);
    wireOwner();
    mockedSend.mockRejectedValueOnce(new Error("push failed"));

    await expect(VaccineReminderEngine.run()).resolves.toBeUndefined();

    // First record threw; second still sent + recorded.
    expect(mockedSend).toHaveBeenCalledTimes(2);
    expect(mocked.immunization.update).toHaveBeenCalledTimes(1);
  });
});
