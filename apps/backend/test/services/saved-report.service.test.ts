import { prisma } from "src/config/prisma";
import { DashboardService } from "src/services/dashboard.service";
import {
  nextReportRunAt,
  SavedReportService,
} from "src/services/saved-report.service";
import { sendEmail } from "src/utils/email";

jest.mock("src/config/prisma", () => ({
  prisma: {
    savedReportView: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reportDeliverySchedule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    userOrganization: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));
jest.mock("src/services/dashboard.service", () => ({
  DashboardService: {
    getSummary: jest.fn(),
    getAppointmentsTrend: jest.fn(),
    getRevenueTrend: jest.fn(),
    getAppointmentLeaders: jest.fn(),
    getRevenueLeaders: jest.fn(),
    getInventoryTurnover: jest.fn(),
    getProductTurnover: jest.fn(),
  },
}));
jest.mock("src/utils/email", () => ({ sendEmail: jest.fn() }));

const view = {
  id: "view-1",
  organisationId: "org-1",
  createdBy: "user-1",
  name: "Weekly summary",
  reportType: "summary",
  parameters: { range: "last_week" },
  createdAt: new Date(),
  updatedAt: new Date(),
};
const schedule = {
  id: "schedule-1",
  organisationId: "org-1",
  viewId: "view-1",
  recipients: ["user-2"],
  cronExpression: "0 9 * * 1",
  timezone: "Europe/London",
  active: true,
  nextRunAt: new Date("2026-10-03T08:00:00Z"),
  claimUntil: null,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  view,
};

describe("SavedReportService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("validates cron expressions and time zones", () => {
    expect(
      nextReportRunAt(
        "0 9 * * 1",
        "Europe/London",
        new Date("2026-10-03T00:00:00Z"),
      ),
    ).toEqual(new Date("2026-10-05T08:00:00Z"));
    expect(() => nextReportRunAt("not cron", "UTC")).toThrow(
      "Invalid cron expression or timezone",
    );
    expect(() => nextReportRunAt("0 9 * * *", "Not/A_Zone")).toThrow(
      "Invalid cron expression or timezone",
    );
  });

  it("creates a scoped view and rejects unsupported report types", async () => {
    (prisma.savedReportView.create as jest.Mock).mockResolvedValue(view);
    await expect(
      SavedReportService.createView({
        organisationId: "org-1",
        createdBy: "user-1",
        name: " Weekly summary ",
        reportType: "summary",
        parameters: {},
      }),
    ).resolves.toEqual(view);
    expect(prisma.savedReportView.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Weekly summary" }),
    });
    expect(() =>
      SavedReportService.createView({
        organisationId: "org-1",
        createdBy: "user-1",
        name: "x",
        reportType: "unknown",
        parameters: {},
      }),
    ).toThrow("Unsupported report type");
  });

  it("keeps view updates and deletes organisation scoped", async () => {
    (prisma.savedReportView.findFirst as jest.Mock).mockResolvedValue(view);
    (prisma.savedReportView.update as jest.Mock).mockResolvedValue({
      ...view,
      name: "New",
    });
    await SavedReportService.updateView({
      organisationId: "org-1",
      viewId: "view-1",
      name: "New",
    });
    expect(prisma.savedReportView.findFirst).toHaveBeenCalledWith({
      where: { id: "view-1", organisationId: "org-1" },
    });
    await SavedReportService.deleteView("org-1", "view-1");
    expect(prisma.savedReportView.delete).toHaveBeenCalledWith({
      where: { id: "view-1" },
    });
    (prisma.savedReportView.findFirst as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      SavedReportService.deleteView("org-1", "other"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("creates and updates schedules with normalized recipients and recomputed next run", async () => {
    (prisma.savedReportView.findFirst as jest.Mock).mockResolvedValue(view);
    (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
      {
        practitionerReference: "user-2",
        roleCode: "OWNER",
        extraPermissions: [],
        revokedPermissions: [],
      },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { userId: "user-2", email: "staff@example.test" },
    ]);
    (prisma.reportDeliverySchedule.create as jest.Mock).mockResolvedValue(
      schedule,
    );
    await SavedReportService.createSchedule({
      organisationId: "org-1",
      viewId: "view-1",
      recipients: [" user-2 ", "user-2"],
      cronExpression: "0 9 * * 1",
      timezone: "Europe/London",
    });
    expect(prisma.reportDeliverySchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ recipients: ["user-2"] }),
    });
    (prisma.reportDeliverySchedule.findFirst as jest.Mock).mockResolvedValue(
      schedule,
    );
    (prisma.reportDeliverySchedule.update as jest.Mock).mockResolvedValue(
      schedule,
    );
    await SavedReportService.updateSchedule({
      organisationId: "org-1",
      scheduleId: "schedule-1",
      active: false,
    });
    expect(prisma.reportDeliverySchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "schedule-1" },
        data: expect.objectContaining({ active: false, claimUntil: null }),
      }),
    );
    await expect(
      SavedReportService.createSchedule({
        organisationId: "org-1",
        viewId: "view-1",
        recipients: [],
        cronExpression: "0 9 * * 1",
        timezone: "UTC",
      }),
    ).rejects.toThrow("At least one recipient is required");

    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([]);
    await expect(
      SavedReportService.createSchedule({
        organisationId: "org-1",
        viewId: "view-1",
        recipients: ["user-3"],
        cronExpression: "0 9 * * 1",
        timezone: "UTC",
      }),
    ).rejects.toThrow("Recipients must be active staff with analytics access");
  });

  it("claims due work, reauthorizes recipients, and sends separate messages", async () => {
    (prisma.reportDeliverySchedule.findMany as jest.Mock).mockResolvedValue([
      { id: "schedule-1" },
    ]);
    (prisma.reportDeliverySchedule.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (
      prisma.reportDeliverySchedule.findUniqueOrThrow as jest.Mock
    ).mockResolvedValue(schedule);
    (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
      {
        practitionerReference: "Practitioner/user-2",
        roleCode: "OWNER",
        extraPermissions: [],
        revokedPermissions: [],
      },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { userId: "user-2", email: "staff@example.test" },
    ]);
    (DashboardService.getSummary as jest.Mock).mockResolvedValue({
      revenue: 10,
    });
    (sendEmail as jest.Mock).mockResolvedValue({});
    (prisma.reportDeliverySchedule.update as jest.Mock).mockResolvedValue(
      schedule,
    );
    await expect(
      SavedReportService.deliverDue(new Date("2026-10-03T09:00:00Z")),
    ).resolves.toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "staff@example.test",
        subject: "Weekly summary",
      }),
    );
    expect(prisma.reportDeliverySchedule.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastError: null }),
      }),
    );
  });

  it("records a failed run when no recipient remains authorised", async () => {
    (prisma.reportDeliverySchedule.findMany as jest.Mock).mockResolvedValue([
      { id: "schedule-1" },
    ]);
    (prisma.reportDeliverySchedule.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (
      prisma.reportDeliverySchedule.findUniqueOrThrow as jest.Mock
    ).mockResolvedValue(schedule);
    (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reportDeliverySchedule.update as jest.Mock).mockResolvedValue(
      schedule,
    );
    await expect(SavedReportService.deliverDue()).resolves.toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.reportDeliverySchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: "No authorised recipients remain",
        }),
      }),
    );
  });

  it("ignores due rows another worker already claimed", async () => {
    (prisma.reportDeliverySchedule.findMany as jest.Mock).mockResolvedValue([
      { id: "schedule-1" },
    ]);
    (prisma.reportDeliverySchedule.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });
    await expect(SavedReportService.deliverDue()).resolves.toBe(0);
    expect(
      prisma.reportDeliverySchedule.findUniqueOrThrow,
    ).not.toHaveBeenCalled();
  });

  it("lists saved views and schedules in newest-first order", async () => {
    (prisma.savedReportView.findMany as jest.Mock).mockResolvedValue([view]);
    (prisma.reportDeliverySchedule.findMany as jest.Mock).mockResolvedValue([
      schedule,
    ]);
    await expect(SavedReportService.listViews("org-1")).resolves.toEqual([
      view,
    ]);
    await expect(SavedReportService.listSchedules("org-1")).resolves.toEqual([
      schedule,
    ]);
    expect(prisma.reportDeliverySchedule.findMany).toHaveBeenCalledWith({
      where: { organisationId: "org-1" },
      include: { view: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("deletes only an organisation-scoped schedule", async () => {
    (prisma.reportDeliverySchedule.findFirst as jest.Mock).mockResolvedValue(
      schedule,
    );
    await SavedReportService.deleteSchedule("org-1", "schedule-1");
    expect(prisma.reportDeliverySchedule.delete).toHaveBeenCalledWith({
      where: { id: "schedule-1" },
    });
    (
      prisma.reportDeliverySchedule.findFirst as jest.Mock
    ).mockResolvedValueOnce(null);
    await expect(
      SavedReportService.deleteSchedule("org-1", "missing"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each([
    ["appointments_trend", "getAppointmentsTrend"],
    ["revenue_trend", "getRevenueTrend"],
    ["appointment_leaders", "getAppointmentLeaders"],
    ["revenue_leaders", "getRevenueLeaders"],
    ["inventory_turnover", "getInventoryTurnover"],
    ["product_turnover", "getProductTurnover"],
  ] as const)(
    "renders a %s saved view through the dashboard service",
    async (reportType, method) => {
      (prisma.reportDeliverySchedule.findMany as jest.Mock).mockResolvedValue([
        { id: "schedule-1" },
      ]);
      (prisma.reportDeliverySchedule.updateMany as jest.Mock).mockResolvedValue(
        {
          count: 1,
        },
      );
      (
        prisma.reportDeliverySchedule.findUniqueOrThrow as jest.Mock
      ).mockResolvedValue({
        ...schedule,
        view: {
          ...view,
          reportType,
          parameters: {
            range: "last_week",
            bucket: "day",
            limit: 3,
            year: 2026,
          },
        },
      });
      (prisma.userOrganization.findMany as jest.Mock).mockResolvedValue([
        {
          practitionerReference: "user-2",
          roleCode: "OWNER",
          extraPermissions: [],
          revokedPermissions: [],
        },
      ]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { userId: "user-2", email: "staff@example.test" },
      ]);
      (DashboardService[method] as jest.Mock).mockResolvedValue([]);
      (sendEmail as jest.Mock).mockResolvedValue({});
      (prisma.reportDeliverySchedule.update as jest.Mock).mockResolvedValue(
        schedule,
      );

      await SavedReportService.deliverDue();

      expect(DashboardService[method]).toHaveBeenCalled();
    },
  );
});
