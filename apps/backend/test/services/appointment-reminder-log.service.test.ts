import { AppointmentReminderLogService } from "../../src/services/appointment-reminder-log.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    appointmentReminderLog: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.appointmentReminderLog.create as jest.Mock;
const mockFindFirst = prisma.appointmentReminderLog.findFirst as jest.Mock;
const mockFindMany = prisma.appointmentReminderLog.findMany as jest.Mock;
const mockUpdate = prisma.appointmentReminderLog.update as jest.Mock;

const baseLog = {
  id: "rl-1",
  organisationId: "org-1",
  appointmentId: "apt-1",
  clientId: "client-1",
  channel: "SMS" as const,
  outcome: "DELIVERED" as const,
  sentAt: new Date("2026-06-30T08:00:00Z"),
  respondedAt: null,
  messagePreview: "Reminder: Bella's appointment tomorrow at 10am.",
  externalId: "twilio-msg-abc123",
  errorMessage: null,
  createdAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("AppointmentReminderLogService.record", () => {
  it("records an SMS reminder as DELIVERED", async () => {
    mockCreate.mockResolvedValue(baseLog);
    const result = await AppointmentReminderLogService.record({
      organisationId: "org-1",
      appointmentId: "apt-1",
      clientId: "client-1",
      channel: "SMS",
      sentAt: new Date("2026-06-30T08:00:00Z"),
      messagePreview: "Reminder: Bella's appointment tomorrow at 10am.",
      externalId: "twilio-msg-abc123",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: "SMS",
          outcome: "DELIVERED",
        }),
      }),
    );
    expect(result.channel).toBe("SMS");
    expect(result.outcome).toBe("DELIVERED");
  });
});

describe("AppointmentReminderLogService.updateOutcome", () => {
  it("marks reminder as CONFIRMED", async () => {
    const confirmed = {
      ...baseLog,
      outcome: "CONFIRMED" as const,
      respondedAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(baseLog);
    mockUpdate.mockResolvedValue(confirmed);
    const result = await AppointmentReminderLogService.updateOutcome(
      "rl-1",
      "org-1",
      "CONFIRMED",
      new Date(),
    );
    expect(result.outcome).toBe("CONFIRMED");
  });

  it("throws 404 when log not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      AppointmentReminderLogService.updateOutcome("rl-x", "org-1", "CONFIRMED"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("AppointmentReminderLogService.listForAppointment", () => {
  it("returns all logs for an appointment", async () => {
    mockFindMany.mockResolvedValue([baseLog]);
    const result = await AppointmentReminderLogService.listForAppointment(
      "apt-1",
      "org-1",
    );
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ appointmentId: "apt-1" }),
      }),
    );
    expect(result).toHaveLength(1);
  });
});

describe("AppointmentReminderLogService.listForClient", () => {
  it("filters by channel", async () => {
    mockFindMany.mockResolvedValue([baseLog]);
    await AppointmentReminderLogService.listForClient("client-1", "org-1", {
      channel: "SMS",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ channel: "SMS" }),
      }),
    );
  });

  it("filters by outcome", async () => {
    mockFindMany.mockResolvedValue([]);
    await AppointmentReminderLogService.listForClient("client-1", "org-1", {
      outcome: "NO_RESPONSE",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ outcome: "NO_RESPONSE" }),
      }),
    );
  });
});

describe("AppointmentReminderLogService.stats", () => {
  it("counts outcomes correctly", async () => {
    mockFindMany.mockResolvedValue([
      { outcome: "DELIVERED" },
      { outcome: "CONFIRMED" },
      { outcome: "DELIVERED" },
    ]);
    const result = await AppointmentReminderLogService.stats("org-1", {});
    expect(result.total).toBe(3);
    expect(result.byOutcome["DELIVERED"]).toBe(2);
    expect(result.byOutcome["CONFIRMED"]).toBe(1);
  });
});
