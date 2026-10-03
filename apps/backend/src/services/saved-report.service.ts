import cronParser from "cron-parser";
import { Prisma } from "@prisma/client";

import { prisma } from "src/config/prisma";
import { computeEffectivePermissions } from "src/middlewares/rbac";
import type { RoleCode } from "src/models/role-permission";
import { DashboardService, type SummaryRange } from "./dashboard.service";
import { organisationReferenceMatches } from "./shared/organisation-membership";
import { sendEmail } from "src/utils/email";

const REPORT_TYPES = [
  "summary",
  "appointments_trend",
  "revenue_trend",
  "appointment_leaders",
  "revenue_leaders",
  "inventory_turnover",
  "product_turnover",
] as const;

export type SavedReportType = (typeof REPORT_TYPES)[number];

export class SavedReportServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "SavedReportServiceError";
  }
}

type ReportParameters = Record<string, unknown>;

const asParameters = (value: Prisma.JsonValue): ReportParameters =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {};

const requiredText = (value: string, field: string) => {
  const normalized = value.trim();
  if (!normalized) throw new SavedReportServiceError(`${field} is required`);
  return normalized;
};

const validateReportType = (value: string): SavedReportType => {
  if (!REPORT_TYPES.includes(value as SavedReportType)) {
    throw new SavedReportServiceError("Unsupported report type");
  }
  return value as SavedReportType;
};

export const nextReportRunAt = (
  cronExpression: string,
  timezone: string,
  currentDate = new Date(),
) => {
  try {
    return cronParser
      .parse(cronExpression, { currentDate, tz: timezone })
      .next()
      .toDate();
  } catch {
    throw new SavedReportServiceError("Invalid cron expression or timezone");
  }
};

const scopedView = async (organisationId: string, viewId: string) => {
  const view = await prisma.savedReportView.findFirst({
    where: { id: viewId, organisationId },
  });
  if (!view)
    throw new SavedReportServiceError("Saved report view not found", 404);
  return view;
};

const scopedSchedule = async (organisationId: string, scheduleId: string) => {
  const schedule = await prisma.reportDeliverySchedule.findFirst({
    where: { id: scheduleId, organisationId },
  });
  if (!schedule)
    throw new SavedReportServiceError("Report schedule not found", 404);
  return schedule;
};

const executeView = async (view: {
  organisationId: string;
  reportType: string;
  parameters: Prisma.JsonValue;
}) => {
  const parameters = asParameters(view.parameters);
  const range = (parameters.range as SummaryRange | undefined) ?? "last_month";
  const bucket = parameters.bucket === "day" ? "day" : "month";
  const limit =
    typeof parameters.limit === "number" ? parameters.limit : undefined;
  const year =
    typeof parameters.year === "number" ? parameters.year : undefined;

  switch (validateReportType(view.reportType)) {
    case "summary":
      return DashboardService.getSummary({
        organisationId: view.organisationId,
        range,
      });
    case "appointments_trend":
      return DashboardService.getAppointmentsTrend({
        organisationId: view.organisationId,
        range,
        bucket,
      });
    case "revenue_trend":
      return DashboardService.getRevenueTrend({
        organisationId: view.organisationId,
        range,
        bucket,
      });
    case "appointment_leaders":
      return DashboardService.getAppointmentLeaders({
        organisationId: view.organisationId,
        range,
        limit,
      });
    case "revenue_leaders":
      return DashboardService.getRevenueLeaders({
        organisationId: view.organisationId,
        range,
        limit,
      });
    case "inventory_turnover":
      return DashboardService.getInventoryTurnover({
        organisationId: view.organisationId,
        range,
        year,
      });
    case "product_turnover":
      return DashboardService.getProductTurnover({
        organisationId: view.organisationId,
        range,
        year,
        limit,
      });
  }
};

const authorisedRecipients = async (
  organisationId: string,
  recipientIds: string[],
) => {
  const references = recipientIds.flatMap((id) => [id, `Practitioner/${id}`]);
  const memberships = await prisma.userOrganization.findMany({
    where: {
      active: true,
      practitionerReference: { in: references },
      OR: organisationReferenceMatches(organisationId),
    },
  });
  const allowedIds = memberships
    .filter((membership) =>
      computeEffectivePermissions(
        membership.roleCode as RoleCode,
        membership.extraPermissions,
        membership.revokedPermissions,
      ).includes("analytics:view:any"),
    )
    .map((membership) =>
      membership.practitionerReference.replace(/^Practitioner\//, ""),
    );

  return prisma.user.findMany({
    where: { userId: { in: allowedIds }, isActive: true },
    select: { userId: true, email: true },
  });
};

const assertRecipientsAuthorised = async (
  organisationId: string,
  recipientIds: string[],
) => {
  const authorised = await authorisedRecipients(organisationId, recipientIds);
  const authorisedIds = new Set(
    authorised.map((recipient) => recipient.userId),
  );
  const rejected = recipientIds.filter((id) => !authorisedIds.has(id));
  if (rejected.length) {
    throw new SavedReportServiceError(
      "Recipients must be active staff with analytics access",
    );
  }
};

export const SavedReportService = {
  listViews: (organisationId: string) =>
    prisma.savedReportView.findMany({
      where: { organisationId },
      orderBy: { createdAt: "desc" },
    }),

  createView(input: {
    organisationId: string;
    createdBy: string;
    name: string;
    reportType: string;
    parameters: Prisma.InputJsonValue;
  }) {
    return prisma.savedReportView.create({
      data: {
        ...input,
        name: requiredText(input.name, "name"),
        reportType: validateReportType(input.reportType),
      },
    });
  },

  async updateView(input: {
    organisationId: string;
    viewId: string;
    name?: string;
    reportType?: string;
    parameters?: Prisma.InputJsonValue;
  }) {
    await scopedView(input.organisationId, input.viewId);
    return prisma.savedReportView.update({
      where: { id: input.viewId },
      data: {
        ...(input.name === undefined
          ? {}
          : { name: requiredText(input.name, "name") }),
        ...(input.reportType === undefined
          ? {}
          : { reportType: validateReportType(input.reportType) }),
        ...(input.parameters === undefined
          ? {}
          : { parameters: input.parameters }),
      },
    });
  },

  async deleteView(organisationId: string, viewId: string) {
    await scopedView(organisationId, viewId);
    await prisma.savedReportView.delete({ where: { id: viewId } });
  },

  listSchedules: (organisationId: string) =>
    prisma.reportDeliverySchedule.findMany({
      where: { organisationId },
      include: { view: true },
      orderBy: { createdAt: "desc" },
    }),

  async createSchedule(input: {
    organisationId: string;
    viewId: string;
    recipients: string[];
    cronExpression: string;
    timezone: string;
    active?: boolean;
  }) {
    await scopedView(input.organisationId, input.viewId);
    const recipients = [
      ...new Set(input.recipients.map((id) => id.trim()).filter(Boolean)),
    ];
    if (!recipients.length)
      throw new SavedReportServiceError("At least one recipient is required");
    await assertRecipientsAuthorised(input.organisationId, recipients);
    const nextRunAt = nextReportRunAt(input.cronExpression, input.timezone);
    return prisma.reportDeliverySchedule.create({
      data: { ...input, recipients, nextRunAt },
    });
  },

  async updateSchedule(input: {
    organisationId: string;
    scheduleId: string;
    recipients?: string[];
    cronExpression?: string;
    timezone?: string;
    active?: boolean;
  }) {
    const current = await scopedSchedule(
      input.organisationId,
      input.scheduleId,
    );
    const recipients = input.recipients
      ? [...new Set(input.recipients.map((id) => id.trim()).filter(Boolean))]
      : undefined;
    if (recipients && !recipients.length)
      throw new SavedReportServiceError("At least one recipient is required");
    if (recipients) {
      await assertRecipientsAuthorised(input.organisationId, recipients);
    }
    const cronExpression = input.cronExpression ?? current.cronExpression;
    const timezone = input.timezone ?? current.timezone;
    const nextRunAt = nextReportRunAt(cronExpression, timezone);
    return prisma.reportDeliverySchedule.update({
      where: { id: input.scheduleId },
      data: {
        recipients,
        cronExpression: input.cronExpression,
        timezone: input.timezone,
        active: input.active,
        nextRunAt,
        claimUntil: null,
      },
    });
  },

  async deleteSchedule(organisationId: string, scheduleId: string) {
    await scopedSchedule(organisationId, scheduleId);
    await prisma.reportDeliverySchedule.delete({ where: { id: scheduleId } });
  },

  async deliverDue(now = new Date()) {
    const due = await prisma.reportDeliverySchedule.findMany({
      where: {
        active: true,
        nextRunAt: { lte: now },
        OR: [{ claimUntil: null }, { claimUntil: { lt: now } }],
      },
      select: { id: true },
      take: 25,
    });
    let delivered = 0;
    for (const candidate of due) {
      const claimUntil = new Date(now.getTime() + 5 * 60_000);
      const claimed = await prisma.reportDeliverySchedule.updateMany({
        where: {
          id: candidate.id,
          active: true,
          nextRunAt: { lte: now },
          OR: [{ claimUntil: null }, { claimUntil: { lt: now } }],
        },
        data: { claimUntil },
      });
      if (!claimed.count) continue;
      const schedule = await prisma.reportDeliverySchedule.findUniqueOrThrow({
        where: { id: candidate.id },
        include: { view: true },
      });
      try {
        const recipients = await authorisedRecipients(
          schedule.organisationId,
          schedule.recipients,
        );
        if (!recipients.length)
          throw new SavedReportServiceError("No authorised recipients remain");
        const report = await executeView(schedule.view);
        for (const recipient of recipients) {
          await sendEmail({
            to: recipient.email,
            subject: schedule.view.name,
            textBody: `${schedule.view.name}\n\n${JSON.stringify(report, null, 2)}`,
          });
        }
        await prisma.reportDeliverySchedule.update({
          where: { id: schedule.id },
          data: {
            claimUntil: null,
            lastError: null,
            lastRunAt: now,
            lastSuccessAt: now,
            nextRunAt: nextReportRunAt(
              schedule.cronExpression,
              schedule.timezone,
              now,
            ),
          },
        });
        delivered += 1;
      } catch (error) {
        await prisma.reportDeliverySchedule.update({
          where: { id: schedule.id },
          data: {
            claimUntil: null,
            lastRunAt: now,
            lastError:
              error instanceof Error
                ? error.message.slice(0, 500)
                : "Report delivery failed",
          },
        });
      }
    }
    return delivered;
  },
};
