import mongoose, { FilterQuery, Types } from "mongoose";
import dayjs from "dayjs";
import AppointmentModel, {
  AppointmentDocument,
  AppointmentMongo,
  AppointmentStatus,
} from "../models/appointment";
import {
  Appointment,
  AppointmentPaymentStatus,
  PaymentCollectionMethod,
  AppointmentRequestDTO,
  AppointmentResponseDTO,
  fromAppointmentRequestDTO,
  toAppointmentResponseDTO,
} from "@yosemite-crew/types";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import ServiceModel from "src/models/service";
import { InvoiceService } from "./invoice.service";
import { StripeService } from "./stripe.service";
import { OccupancyModel } from "src/models/occupancy";
import OrganizationModel from "src/models/organization";
import UserProfileModel from "src/models/user-profile";
import UserModel from "src/models/user";
import { ParentModel } from "src/models/parent";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";
import { TaskService } from "./task.service";
import { FormService, FormServiceError } from "./form.service";
import { OrgBilling } from "src/models/organization.billing";
import { OrgUsageCounters } from "src/models/organisation.usage.counter";
import { sendEmailTemplate } from "src/utils/email";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import logger from "src/utils/logger";
import { sendFreePlanLimitReachedEmail } from "src/utils/org-usage-notifications";
import { AuditTrailService } from "./audit-trail.service";
import { FormModel } from "src/models/form";
import InvoiceModel from "src/models/invoice";

export class AppointmentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppointmentServiceError";
  }
}

const ensureObjectId = (id: string | Types.ObjectId, field: string) => {
  if (id instanceof Types.ObjectId) return id;
  if (!Types.ObjectId.isValid(id)) {
    throw new AppointmentServiceError(`Invalid ${field}`, 400);
  }
  return new Types.ObjectId(id);
};

type LegacyAppointmentStatus = AppointmentStatus | "NO_PAYMENT";

const normalizeAppointmentStatus = (
  status: LegacyAppointmentStatus,
): AppointmentStatus => (status === "NO_PAYMENT" ? "REQUESTED" : status);

const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  AppointmentStatus[]
> = {
  REQUESTED: ["UPCOMING", "CANCELLED"],
  UPCOMING: ["CHECKED_IN", "CANCELLED", "NO_SHOW", "REQUESTED"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const assertAppointmentStatusTransition = (
  current: LegacyAppointmentStatus,
  next: AppointmentStatus,
  context: string,
) => {
  const normalizedCurrent = normalizeAppointmentStatus(current);
  if (normalizedCurrent === next) return;

  const allowed = APPOINTMENT_STATUS_TRANSITIONS[normalizedCurrent] ?? [];
  if (!allowed.includes(next)) {
    throw new AppointmentServiceError(
      `Appointment cannot transition from ${normalizedCurrent} to ${next} in ${context}.`,
      409,
    );
  }
};

const resolvePaymentCollectionMethod = (
  value?: string,
): PaymentCollectionMethod | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  const allowed: PaymentCollectionMethod[] = [
    "PAYMENT_INTENT",
    "PAYMENT_LINK",
    "PAYMENT_AT_CLINIC",
  ];
  if (!allowed.includes(normalized as PaymentCollectionMethod)) {
    throw new AppointmentServiceError(
      "Invalid payment collection method.",
      400,
    );
  }
  return normalized as PaymentCollectionMethod;
};

const resolvePaymentStatusByAppointmentIds = async (
  appointmentIds: string[],
): Promise<Map<string, AppointmentPaymentStatus>> => {
  const uniqueIds = Array.from(new Set(appointmentIds.filter(Boolean)));
  const statusMap = new Map<string, AppointmentPaymentStatus>();

  if (uniqueIds.length === 0) {
    return statusMap;
  }

  const results: Array<{
    _id: string;
    hasPaid: number;
    hasUnpaid: number;
  }> = await InvoiceModel.aggregate([
    { $match: { appointmentId: { $in: uniqueIds } } },
    {
      $group: {
        _id: "$appointmentId",
        hasPaid: {
          $max: {
            $cond: [{ $eq: ["$status", "PAID"] }, 1, 0],
          },
        },
        hasUnpaid: {
          $max: {
            $cond: [
              {
                $in: [
                  "$status",
                  ["PENDING", "AWAITING_PAYMENT", "FAILED", "REFUNDED"],
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  for (const row of results) {
    const paid = row.hasPaid === 1 && row.hasUnpaid === 0;
    statusMap.set(row._id, paid ? "PAID" : "UNPAID");
  }

  return statusMap;
};

type AppointmentRequestInput = ReturnType<typeof fromAppointmentRequestDTO>;

const validateRequestedFromMobileInput = (input: AppointmentRequestInput) => {
  if (!input.organisationId) {
    throw new AppointmentServiceError("organisationId is required", 400);
  }
  if (!input.companion?.id || !input.companion.parent?.id) {
    throw new AppointmentServiceError(
      "Companion and parent details are required",
      400,
    );
  }
  if (!input.startTime || !input.endTime || !input.durationMinutes) {
    throw new AppointmentServiceError(
      "startTime, endTime, durationMinutes required",
      400,
    );
  }
};

const validateAppointmentFromPmsInput = (input: AppointmentRequestInput) => {
  if (!input.organisationId) {
    throw new AppointmentServiceError("organisationId is required.", 400);
  }
  if (!input.companion?.id || !input.companion.parent?.id) {
    throw new AppointmentServiceError(
      "Companion and parent information is required.",
      400,
    );
  }
  if (!input.startTime || !input.endTime || !input.durationMinutes) {
    throw new AppointmentServiceError(
      "startTime, endTime and durationMinutes are required.",
      400,
    );
  }
  if (!input.lead?.id) {
    throw new AppointmentServiceError(
      "Lead veterinarian (vet) is required.",
      400,
    );
  }
  if (!input.appointmentType?.id) {
    throw new AppointmentServiceError(
      "Service (appointmentType.id) is required.",
      400,
    );
  }
};

const getConsentFormForParentSafe = async (
  organisationId: Types.ObjectId,
  serviceId: Types.ObjectId,
) => {
  try {
    return await FormService.getConsentFormForParent(
      organisationId.toString(),
      { serviceId: serviceId.toString() },
    );
  } catch (err) {
    if (err instanceof FormServiceError && err.statusCode === 404) {
      return null; // expected case
    }
    throw err; // real error
  }
};

const sendCheckoutEmailIfNeeded = async ({
  checkout,
  invoice,
  appointment,
  organisationName,
}: {
  checkout?: { url?: string | null };
  invoice: { totalAmount?: number; currency: string };
  appointment: Appointment;
  organisationName?: string | null;
}) => {
  if (!checkout?.url) return;

  const parent = await ParentModel.findById(appointment.companion.parent.id)
    .select("email firstName lastName")
    .lean();
  if (!parent?.email) return;

  const parentName = [parent.firstName, parent.lastName]
    .filter(Boolean)
    .join(" ");
  const amountText =
    typeof invoice.totalAmount === "number"
      ? `${invoice.currency.toUpperCase()} ${invoice.totalAmount.toFixed(2)}`
      : undefined;
  const appointmentTime = dayjs(appointment.startTime).format(
    "MMM D, YYYY h:mm A",
  );

  await sendEmailTemplate({
    to: parent.email,
    templateId: "appointmentPaymentCheckout",
    templateData: {
      parentName: parentName || undefined,
      companionName: appointment.companion.name,
      organisationName: organisationName ?? undefined,
      appointmentTime,
      amountText,
      checkoutUrl: checkout.url,
      ctaUrl: checkout.url,
      ctaLabel: "Pay Now",
      supportEmail: SUPPORT_EMAIL_ADDRESS,
    },
  });
};

const recordFormAttachmentAudit = async (
  appointment: Appointment,
  appointmentId: string,
) => {
  if (!appointment.formIds?.length) return;

  for (const formId of appointment.formIds) {
    await AuditTrailService.recordSafely({
      organisationId: appointment.organisationId,
      companionId: appointment.companion.id,
      eventType: "FORM_ATTACHED",
      actorType: "SYSTEM",
      entityType: "FORM",
      entityId: formId,
      metadata: {
        appointmentId,
      },
    });
  }
};

const resolveObservationToolId = (value: unknown) => {
  if (!value) return undefined;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_id" in value) {
    const id = (value as { _id?: Types.ObjectId | string })._id;
    if (id instanceof Types.ObjectId) return id.toString();
    if (typeof id === "string") return id;
  }
  return undefined;
};

const maybeCreateObservationToolTask = async (
  service: { serviceType?: string; observationToolId?: unknown },
  appointment: Appointment,
  appointmentId: string,
) => {
  if (service.serviceType !== "OBSERVATION_TOOL") return;
  const observationToolId = resolveObservationToolId(service.observationToolId);
  if (!observationToolId) return;

  await createObservationToolTaskForAppointment({
    appointmentId,
    organisationId: appointment.organisationId,
    companionId: appointment.companion.id,
    parentId: appointment.companion.parent.id,
    observationToolId,
    appointmentStartTime: appointment.startTime,
  });
};

const ensureOrgUsageCounters = async (orgId: Types.ObjectId) => {
  const doc = await OrgUsageCounters.findOneAndUpdate(
    { orgId },
    { $setOnInsert: { orgId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  if (doc && shouldDualWrite) {
    try {
      await prisma.organizationUsageCounter.upsert({
        where: { orgId: orgId.toString() },
        create: {
          id: doc._id.toString(),
          orgId: orgId.toString(),
          appointmentsUsed: doc.appointmentsUsed ?? 0,
          toolsUsed: doc.toolsUsed ?? 0,
          usersActiveCount: doc.usersActiveCount ?? 0,
          usersBillableCount: doc.usersBillableCount ?? 0,
          freeAppointmentsLimit: doc.freeAppointmentsLimit ?? 120,
          freeToolsLimit: doc.freeToolsLimit ?? 200,
          freeUsersLimit: doc.freeUsersLimit ?? 10,
          freeLimitReachedAt: doc.freeLimitReachedAt ?? undefined,
          createdAt: doc.createdAt ?? undefined,
          updatedAt: doc.updatedAt ?? undefined,
        },
        update: {
          appointmentsUsed: doc.appointmentsUsed ?? 0,
          toolsUsed: doc.toolsUsed ?? 0,
          usersActiveCount: doc.usersActiveCount ?? 0,
          usersBillableCount: doc.usersBillableCount ?? 0,
          freeAppointmentsLimit: doc.freeAppointmentsLimit ?? 120,
          freeToolsLimit: doc.freeToolsLimit ?? 200,
          freeUsersLimit: doc.freeUsersLimit ?? 10,
          freeLimitReachedAt: doc.freeLimitReachedAt ?? undefined,
          updatedAt: doc.updatedAt ?? undefined,
        },
      });
    } catch (err) {
      handleDualWriteError("OrganizationUsageCounter ensure", err);
    }
  }

  return doc;
};

const isFreePlan = async (orgId: Types.ObjectId) => {
  const billing = await OrgBilling.findOne({ orgId }).select("plan").lean();
  return !billing || billing.plan === "free";
};

const markFreeLimitReachedAt = async (
  usage: Awaited<ReturnType<typeof ensureOrgUsageCounters>>,
) => {
  if (
    !usage ||
    usage.freeLimitReachedAt ||
    ((usage.usersActiveCount ?? 0) < (usage.freeUsersLimit ?? 0) &&
      (usage.appointmentsUsed ?? 0) < (usage.freeAppointmentsLimit ?? 0) &&
      (usage.toolsUsed ?? 0) < (usage.freeToolsLimit ?? 0))
  ) {
    return false;
  }

  const reachedAt = new Date();
  const updated = await OrgUsageCounters.updateOne(
    { _id: usage._id, freeLimitReachedAt: null },
    { $set: { freeLimitReachedAt: reachedAt } },
  );

  if (shouldDualWrite && updated.modifiedCount > 0) {
    try {
      await prisma.organizationUsageCounter.updateMany({
        where: { orgId: usage.orgId.toString() },
        data: { freeLimitReachedAt: reachedAt },
      });
    } catch (err) {
      handleDualWriteError("OrganizationUsageCounter freeLimitReachedAt", err);
    }
  }
  return updated.modifiedCount > 0;
};

const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL ??
  process.env.SUPPORT_EMAIL_ADDRESS ??
  process.env.HELP_EMAIL ??
  "support@yosemitecrew.com";
const DEFAULT_PMS_URL =
  process.env.PMS_BASE_URL ??
  process.env.FRONTEND_BASE_URL ??
  process.env.APP_URL ??
  "https://app.yosemitecrew.com";

const buildDisplayName = (user?: { firstName?: string; lastName?: string }) => {
  if (!user) return undefined;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
};

type OrganisationNameQuery = {
  select: (fields: string) => { lean: () => Promise<{ name?: string }> };
};

const isOrganisationNameQuery = (
  value: unknown,
): value is OrganisationNameQuery =>
  !!value && typeof (value as { select?: unknown }).select === "function";

const getOrganisationName = async (
  organisationId?: string,
): Promise<string | undefined> => {
  if (!organisationId) return undefined;
  if (typeof OrganizationModel.findById !== "function") {
    return undefined;
  }
  const query = OrganizationModel.findById(organisationId) as unknown;
  if (!isOrganisationNameQuery(query)) {
    return undefined;
  }
  const organisation = await query.select("name").lean();
  return organisation?.name;
};

const sendAppointmentAssignmentEmails = async (
  appointment: AppointmentDocument,
  organisationName?: string,
) => {
  try {
    const staff = [
      appointment.lead
        ? { id: appointment.lead.id, name: appointment.lead.name }
        : undefined,
      ...(appointment.supportStaff ?? []).map((member) => ({
        id: member.id,
        name: member.name,
      })),
    ].filter(Boolean) as Array<{ id: string; name?: string }>;

    if (!staff.length) return;

    const staffIds = [...new Set(staff.map((member) => member.id))];
    const users = await UserModel.find(
      { userId: { $in: staffIds } },
      { userId: 1, email: 1, firstName: 1, lastName: 1 },
    ).lean();

    const userById = new Map(users.map((user) => [user.userId, user]));
    const nameById = new Map(staff.map((member) => [member.id, member.name]));
    const appointmentTime = dayjs(appointment.startTime).format(
      "MMM D, YYYY h:mm A",
    );

    await Promise.all(
      staffIds.map(async (userId) => {
        const user = userById.get(userId);
        const email = user?.email;
        if (!email) return;

        const employeeName =
          buildDisplayName(user) ?? nameById.get(userId) ?? undefined;

        try {
          await sendEmailTemplate({
            to: email,
            templateId: "appointmentAssigned",
            templateData: {
              employeeName,
              companionName: appointment.companion.name,
              appointmentType: appointment.appointmentType?.name,
              appointmentTime,
              organisationName,
              locationName: appointment.room?.name,
              ctaUrl: DEFAULT_PMS_URL,
              ctaLabel: "Open PMS",
              supportEmail: SUPPORT_EMAIL_ADDRESS,
            },
          });
        } catch (error) {
          logger.error("Failed to send appointment assignment email.", error);
        }
      }),
    );
  } catch (error) {
    logger.error("Failed to prepare appointment assignment emails.", error);
  }
};

type AppointmentUsageIncrement = {
  appointmentsUsed: number;
  toolsUsed?: number;
};

const reserveAppointmentUsage = async (
  orgId: Types.ObjectId,
  isObservationTool: boolean,
) => {
  await ensureOrgUsageCounters(orgId);

  const inc: AppointmentUsageIncrement = { appointmentsUsed: 1 };
  if (isObservationTool) {
    inc.toolsUsed = 1;
  }

  if (await isFreePlan(orgId)) {
    const expr = isObservationTool
      ? {
          $and: [
            { $lt: ["$appointmentsUsed", "$freeAppointmentsLimit"] },
            { $lt: ["$toolsUsed", "$freeToolsLimit"] },
          ],
        }
      : { $lt: ["$appointmentsUsed", "$freeAppointmentsLimit"] };

    const updated = await OrgUsageCounters.findOneAndUpdate(
      { orgId, $expr: expr },
      { $inc: inc },
      { new: true },
    );

    if (!updated) {
      const usage = await OrgUsageCounters.findOne({ orgId });
      const toolsLimitReached =
        isObservationTool &&
        (usage?.toolsUsed ?? 0) >= (usage?.freeToolsLimit ?? 0);
      const appointmentsLimitReached =
        (usage?.appointmentsUsed ?? 0) >= (usage?.freeAppointmentsLimit ?? 0);

      const message = (() => {
        if (toolsLimitReached) {
          return "Free plan observation tool appointment limit reached.";
        }

        if (appointmentsLimitReached) {
          return "Free plan appointment limit reached.";
        }

        return "Free plan usage limit reached.";
      })();

      throw new AppointmentServiceError(message, 403);
    }

    if (shouldDualWrite) {
      try {
        await prisma.organizationUsageCounter.updateMany({
          where: { orgId: orgId.toString() },
          data: {
            appointmentsUsed: updated.appointmentsUsed ?? 0,
            toolsUsed: updated.toolsUsed ?? 0,
            usersActiveCount: updated.usersActiveCount ?? 0,
            usersBillableCount: updated.usersBillableCount ?? 0,
            freeAppointmentsLimit: updated.freeAppointmentsLimit ?? 120,
            freeToolsLimit: updated.freeToolsLimit ?? 200,
            freeUsersLimit: updated.freeUsersLimit ?? 10,
            freeLimitReachedAt: updated.freeLimitReachedAt ?? undefined,
            updatedAt: updated.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("OrganizationUsageCounter reserve", err);
      }
    }

    const didReachLimit = await markFreeLimitReachedAt(updated);
    if (didReachLimit) {
      void sendFreePlanLimitReachedEmail({ orgId, usage: updated });
    }
    return { orgId, inc };
  }

  const updated = await OrgUsageCounters.findOneAndUpdate(
    { orgId },
    { $inc: inc },
    { new: true },
  );

  if (updated && shouldDualWrite) {
    try {
      await prisma.organizationUsageCounter.updateMany({
        where: { orgId: orgId.toString() },
        data: {
          appointmentsUsed: updated.appointmentsUsed ?? 0,
          toolsUsed: updated.toolsUsed ?? 0,
          usersActiveCount: updated.usersActiveCount ?? 0,
          usersBillableCount: updated.usersBillableCount ?? 0,
          freeAppointmentsLimit: updated.freeAppointmentsLimit ?? 120,
          freeToolsLimit: updated.freeToolsLimit ?? 200,
          freeUsersLimit: updated.freeUsersLimit ?? 10,
          freeLimitReachedAt: updated.freeLimitReachedAt ?? undefined,
          updatedAt: updated.updatedAt ?? undefined,
        },
      });
    } catch (err) {
      handleDualWriteError("OrganizationUsageCounter reserve", err);
    }
  }

  return { orgId, inc };
};

const releaseAppointmentUsage = async (reservation: {
  orgId: Types.ObjectId;
  inc: AppointmentUsageIncrement;
}) => {
  const dec = Object.fromEntries(
    Object.entries(reservation.inc)
      .filter(([, value]) => typeof value === "number")
      .map(([key, value]) => [key, -value]),
  );

  await OrgUsageCounters.updateOne({ orgId: reservation.orgId }, { $inc: dec });

  if (shouldDualWrite) {
    try {
      const data: Prisma.OrganizationUsageCounterUpdateManyMutationInput = {};
      if (typeof reservation.inc.appointmentsUsed === "number") {
        data.appointmentsUsed = {
          increment: -reservation.inc.appointmentsUsed,
        };
      }
      if (typeof reservation.inc.toolsUsed === "number") {
        data.toolsUsed = { increment: -reservation.inc.toolsUsed };
      }

      if (Object.keys(data).length > 0) {
        await prisma.organizationUsageCounter.updateMany({
          where: { orgId: reservation.orgId.toString() },
          data,
        });
      }
    } catch (err) {
      handleDualWriteError("OrganizationUsageCounter release", err);
    }
  }
};

const toDomain = (doc: AppointmentDocument): Appointment => {
  const obj = doc.toObject() as AppointmentMongo & {
    _id: Types.ObjectId;
  };

  return {
    id: obj._id.toString(),
    companion: obj.companion,
    lead: obj.lead ?? undefined,
    supportStaff: obj.supportStaff ?? [],
    room: obj.room ?? undefined,
    appointmentType: obj.appointmentType ?? undefined,
    organisationId: obj.organisationId,
    appointmentDate: obj.appointmentDate,
    startTime: obj.startTime,
    timeSlot: obj.timeSlot,
    durationMinutes: obj.durationMinutes,
    endTime: obj.endTime,
    status: normalizeAppointmentStatus(obj.status as LegacyAppointmentStatus),
    isEmergency: obj.isEmergency ?? undefined,
    concern: obj.concern ?? undefined,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    attachments: obj.attachments,
    formIds: obj.formIds ?? [],
  };
};

const toDomainLean = (
  doc: AppointmentDocument | (AppointmentMongo & { _id?: Types.ObjectId }),
): Appointment => {
  const obj =
    "toObject" in doc && typeof doc.toObject === "function"
      ? (doc.toObject() as AppointmentMongo & { _id: Types.ObjectId })
      : (doc as AppointmentMongo & { _id?: Types.ObjectId });

  const id = obj._id ? obj._id.toString() : undefined;

  return {
    id,
    companion: obj.companion,
    lead: obj.lead ?? undefined,
    supportStaff: obj.supportStaff ?? [],
    room: obj.room ?? undefined,
    appointmentType: obj.appointmentType ?? undefined,
    organisationId: obj.organisationId,
    appointmentDate: obj.appointmentDate,
    startTime: obj.startTime,
    timeSlot: obj.timeSlot,
    durationMinutes: obj.durationMinutes,
    endTime: obj.endTime,
    status: normalizeAppointmentStatus(obj.status as LegacyAppointmentStatus),
    isEmergency: obj.isEmergency ?? undefined,
    concern: obj.concern ?? undefined,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    attachments: obj.attachments,
    formIds: obj.formIds ?? [],
  };
};

const attachPaymentStatus = (
  appointment: Appointment,
  paymentStatus: AppointmentPaymentStatus | undefined,
): Appointment => {
  if (paymentStatus) {
    appointment.paymentStatus = paymentStatus;
  }
  return appointment;
};

const buildPaymentStatusMapForDocs = async (
  docs: AppointmentMongo[],
): Promise<Map<string, AppointmentPaymentStatus>> => {
  const appointmentIds = docs
    .map((doc) => (doc as AppointmentMongo & { _id?: Types.ObjectId })._id)
    .filter((id): id is Types.ObjectId => Boolean(id))
    .map((id) => id.toString());

  return resolvePaymentStatusByAppointmentIds(appointmentIds);
};

const resolvePaymentStatusForAppointment = async (
  appointmentId: string,
): Promise<AppointmentPaymentStatus> => {
  const map = await resolvePaymentStatusByAppointmentIds([appointmentId]);
  return map.get(appointmentId) ?? "UNPAID";
};

const toAppointmentResponseDTOWithPaymentStatus = async (
  doc: AppointmentDocument,
): Promise<AppointmentResponseDTO> => {
  const appointmentId = doc._id.toString();
  const paymentStatus = await resolvePaymentStatusForAppointment(appointmentId);
  const domain = attachPaymentStatus(toDomain(doc), paymentStatus);
  return toAppointmentResponseDTO(domain);
};

const toPersistable = (appointment: Appointment): AppointmentMongo => ({
  companion: appointment.companion,
  lead: appointment.lead,
  supportStaff: appointment.supportStaff ?? [],
  room: appointment.room,
  appointmentType: appointment.appointmentType,
  organisationId: appointment.organisationId,
  appointmentDate: appointment.appointmentDate,
  startTime: appointment.startTime,
  timeSlot: appointment.timeSlot,
  durationMinutes: appointment.durationMinutes,
  endTime: appointment.endTime,
  status: appointment.status,
  isEmergency: appointment.isEmergency ?? false,
  concern: appointment.concern ?? undefined,
  attachments: appointment.attachments ?? undefined,
  formIds: appointment.formIds ?? [],
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
});

const toPrismaAppointmentData = (
  doc: AppointmentDocument | (AppointmentMongo & { _id?: Types.ObjectId }),
) => {
  const obj =
    "toObject" in doc && typeof doc.toObject === "function"
      ? (doc.toObject() as AppointmentMongo & { _id: Types.ObjectId })
      : (doc as AppointmentMongo & { _id?: Types.ObjectId });

  if (!obj._id) {
    throw new AppointmentServiceError("Appointment missing id", 500);
  }

  return {
    id: obj._id.toString(),
    companion: obj.companion as unknown as Prisma.InputJsonValue,
    lead: (obj.lead ?? undefined) as unknown as Prisma.InputJsonValue,
    supportStaff: (obj.supportStaff ?? []) as unknown as Prisma.InputJsonValue,
    room: (obj.room ?? undefined) as unknown as Prisma.InputJsonValue,
    appointmentType: (obj.appointmentType ??
      undefined) as unknown as Prisma.InputJsonValue,
    organisationId: obj.organisationId,
    appointmentDate: obj.appointmentDate,
    startTime: obj.startTime,
    endTime: obj.endTime,
    timeSlot: obj.timeSlot,
    durationMinutes: obj.durationMinutes,
    status: normalizeAppointmentStatus(obj.status as LegacyAppointmentStatus),
    isEmergency: obj.isEmergency ?? false,
    concern: obj.concern ?? undefined,
    attachments: (obj.attachments ??
      undefined) as unknown as Prisma.InputJsonValue,
    formIds: obj.formIds ?? [],
    expiresAt: obj.expiresAt ?? undefined,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncAppointmentToPostgres = async (
  doc: AppointmentDocument | (AppointmentMongo & { _id?: Types.ObjectId }),
) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaAppointmentData(doc);
    await prisma.appointment.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("Appointment", err);
  }
};

type DateRangeQuery = {
  $gte?: Date;
  $lte?: Date;
};

function extractApprovalFieldsFromFHIR(dto: AppointmentRequestDTO) {
  const leadParticipant = dto.participant?.find((p) =>
    p.type?.some((t) => t.coding?.some((c) => c.code === "PPRF")),
  );

  const supportStaff = dto.participant
    ?.filter((p) =>
      p.type?.some((t) => t.coding?.some((c) => c.code === "SPRF")),
    )
    .map((p) => ({
      id: p.actor?.reference?.split("/")[1] ?? "",
      name: p.actor?.display ?? "",
    }));

  const roomParticipant = dto.participant?.find((p) =>
    p.type?.some((t) => t.coding?.some((c) => c.code === "LOC")),
  );

  return {
    leadVetId: leadParticipant?.actor?.reference?.split("/")[1],
    leadVetName: leadParticipant?.actor?.display,

    supportStaff,
    room: roomParticipant
      ? {
          id: roomParticipant.actor?.reference?.split("/")[1] ?? "",
          name: roomParticipant.actor?.display ?? "",
        }
      : undefined,
  };
}

export const AppointmentService = {
  // Request an appointment from Parent

  async createRequestedFromMobile(dto: AppointmentRequestDTO) {
    const input = fromAppointmentRequestDTO(dto);

    validateRequestedFromMobileInput(input);

    // Validate service
    const serviceId = ensureObjectId(input.appointmentType!.id, "serviceId");
    const organisationId = ensureObjectId(
      input.organisationId,
      "organisationId",
    );
    const service = await ServiceModel.findOne({
      _id: serviceId,
      organisationId: organisationId,
      isActive: true,
    });

    if (!service) {
      throw new AppointmentServiceError("Invalid service selected", 404);
    }

    const usageReservation = await reserveAppointmentUsage(
      organisationId,
      service.serviceType === "OBSERVATION_TOOL",
    );

    const consentForm = await getConsentFormForParentSafe(
      organisationId,
      serviceId,
    );

    if (consentForm) {
      input.formIds?.push(consentForm.id!);
    }

    const appointment: Appointment = {
      id: undefined,
      organisationId: input.organisationId,
      companion: input.companion,
      appointmentType: input.appointmentType,
      appointmentDate: input.startTime,
      startTime: input.startTime,
      endTime: input.endTime,
      timeSlot: dayjs(input.startTime).format("HH:mm"),
      durationMinutes: input.durationMinutes,
      status: "REQUESTED",
      concern: input.concern,
      isEmergency: input.isEmergency,
      lead: undefined,
      supportStaff: [],
      room: undefined,
      attachments: input.attachments,
      formIds: input.formIds ?? [],

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const persistable = toPersistable(appointment);
    let savedAppointment: AppointmentDocument;
    try {
      savedAppointment = await AppointmentModel.create(persistable);
    } catch (error) {
      await releaseAppointmentUsage(usageReservation);
      throw error;
    }

    await syncAppointmentToPostgres(savedAppointment);

    await AuditTrailService.recordSafely({
      organisationId: appointment.organisationId,
      companionId: appointment.companion.id,
      eventType: "APPOINTMENT_REQUESTED",
      actorType: "PARENT",
      actorId: appointment.companion.parent.id,
      entityType: "APPOINTMENT",
      entityId: savedAppointment._id.toString(),
      metadata: {
        status: savedAppointment.status,
        formIds: appointment.formIds ?? [],
      },
    });

    await recordFormAttachmentAudit(
      appointment,
      savedAppointment._id.toString(),
    );

    const paymentIntent = await StripeService.createPaymentIntentForAppointment(
      savedAppointment._id.toString(),
    );

    await maybeCreateObservationToolTask(
      service,
      appointment,
      savedAppointment._id.toString(),
    );

    return {
      appointment:
        await toAppointmentResponseDTOWithPaymentStatus(savedAppointment),
      paymentIntent,
    };
  },

  // Create an appointment from PMS with paynow and paylater

  async createAppointmentFromPms(
    dto: AppointmentRequestDTO,
    createPayment: boolean,
    paymentCollectionMethod?: string,
  ) {
    const input = fromAppointmentRequestDTO(dto);

    // 1️⃣ Validate required fields
    validateAppointmentFromPmsInput(input);

    const resolvedPaymentCollectionMethod =
      resolvePaymentCollectionMethod(paymentCollectionMethod) ?? "PAYMENT_LINK";

    if (
      resolvedPaymentCollectionMethod === "PAYMENT_AT_CLINIC" &&
      createPayment
    ) {
      throw new AppointmentServiceError(
        "Cannot create online payment for in-clinic collection.",
        400,
      );
    }

    // 2️⃣ Validate service
    const serviceId = ensureObjectId(input.appointmentType!.id, "serviceId");
    const organisationId = ensureObjectId(
      input.organisationId,
      "organisationId",
    );
    const service = await ServiceModel.findOne({
      _id: serviceId,
      organisationId: organisationId,
      isActive: true,
    }).lean();

    if (!service) {
      throw new AppointmentServiceError(
        "Invalid or inactive service for this organisation.",
        404,
      );
    }

    const usageReservation = await reserveAppointmentUsage(
      organisationId,
      service.serviceType === "OBSERVATION_TOOL",
    );

    const consentForm = await getConsentFormForParentSafe(
      organisationId,
      serviceId,
    );

    if (consentForm) {
      input.formIds?.push(consentForm.id!);
    }

    const pricing = {
      baseCost: service.cost,
      quantity: 1,
      finalCost: service.cost,
      discountPercent: service.maxDiscount ?? undefined,
    };

    const appointment: Appointment = {
      id: undefined,

      organisationId: input.organisationId,
      companion: input.companion,
      appointmentType: input.appointmentType,

      appointmentDate: input.startTime,
      startTime: input.startTime,
      endTime: input.endTime,
      timeSlot: dayjs(input.startTime).format("HH:mm"),
      durationMinutes: input.durationMinutes,

      status: "UPCOMING",
      concern: input.concern,
      isEmergency: input.isEmergency ?? false,

      lead: input.lead,
      supportStaff: input.supportStaff ?? [],
      room: input.room ?? undefined,
      attachments: input.attachments,
      formIds: input.formIds ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const persistable = toPersistable(appointment);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 4.1 Check overlapping occupancy for lead vet
      const overlapping = await OccupancyModel.findOne({
        organisationId: appointment.organisationId,
        userId: appointment.lead!.id,
        startTime: { $lt: appointment.endTime },
        endTime: { $gt: appointment.startTime },
      }).session(session);

      if (overlapping) {
        throw new AppointmentServiceError(
          "Selected vet is not available for this time slot.",
          409,
        );
      }

      // 4.2 Create Appointment
      const [doc] = await AppointmentModel.create([persistable], { session });

      // 4.3 Create Occupancy for lead vet
      await OccupancyModel.create(
        [
          {
            userId: appointment.lead!.id,
            organisationId: appointment.organisationId,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            sourceType: "APPOINTMENT",
            referenceId: doc._id.toString(),
          },
        ],
        { session },
      );

      const [invoice] = await InvoiceService.createDraftForAppointment(
        {
          appointmentId: doc._id.toString(),
          parentId: appointment.companion.parent.id,
          companionId: appointment.companion.id,
          organisationId: appointment.organisationId,
          items: [
            {
              description: appointment.appointmentType?.name ?? "Consultation",
              quantity: 1,
              unitPrice: pricing.baseCost,
              discountPercent: pricing.discountPercent,
            },
          ],
          notes: appointment.concern,
          paymentCollectionMethod: resolvedPaymentCollectionMethod,
        },
        session,
      );

      let checkout;

      await session.commitTransaction();
      await session.endSession();

      await syncAppointmentToPostgres(doc);

      await AuditTrailService.recordSafely({
        organisationId: appointment.organisationId,
        companionId: appointment.companion.id,
        eventType: "APPOINTMENT_CREATED",
        actorType: "SYSTEM",
        entityType: "APPOINTMENT",
        entityId: doc._id.toString(),
        metadata: {
          status: doc.status,
          formIds: appointment.formIds ?? [],
        },
      });

      await recordFormAttachmentAudit(appointment, doc._id.toString());

      // 4.5 Optional — create PaymentIntent (ONLY if PMS wants immediate payment)
      if (createPayment === true) {
        checkout = await StripeService.createCheckoutSessionForInvoice(
          invoice._id.toString(),
        );
      }

      if (
        service.serviceType === "OBSERVATION_TOOL" &&
        service.observationToolId
      ) {
        await createObservationToolTaskForAppointment({
          appointmentId: doc._id.toString(),
          organisationId: appointment.organisationId,
          companionId: appointment.companion.id,
          parentId: appointment.companion.parent.id,
          observationToolId: service.observationToolId._id.toString(),
          appointmentStartTime: appointment.startTime,
        });
      }

      const notificationPayload = NotificationTemplates.Appointment.APPROVED(
        appointment.companion.name,
        appointment.startTime.toDateString(),
      );

      // Send notification to parent
      const parentId = appointment.companion.parent.id;
      await NotificationService.sendToUser(parentId, notificationPayload);

      const organisationName = await getOrganisationName(
        appointment.organisationId,
      );
      await sendAppointmentAssignmentEmails(doc, organisationName);

      await sendCheckoutEmailIfNeeded({
        checkout,
        invoice,
        appointment,
        organisationName,
      });

      return {
        appointment: await toAppointmentResponseDTOWithPaymentStatus(doc),
        invoice,
        checkout,
      };
    } catch (err) {
      await session.abortTransaction();
      await session.endSession();
      await releaseAppointmentUsage(usageReservation);
      if (err instanceof AppointmentServiceError) throw err;
      throw new AppointmentServiceError("Unable to create appointment", 500);
    }
  },

  // Aprprove Appointment from PMS (REUQUESTED -> UPCOMING)

  async approveRequestedFromPms(
    appointmentId: string,
    dto: AppointmentRequestDTO,
  ) {
    if (!appointmentId) {
      throw new AppointmentServiceError("Appointment ID missing", 400);
    }

    const extracted = extractApprovalFieldsFromFHIR(dto);

    if (!extracted.leadVetId) {
      throw new AppointmentServiceError(
        "Lead vet (Practitioner with code=PPRF) is required",
        400,
      );
    }

    const appointmentObjectId = ensureObjectId(appointmentId, "appointmentId");
    const appointment = await AppointmentModel.findById(appointmentObjectId);

    if (!appointment) {
      throw new AppointmentServiceError(
        "Requested appointment not found or already processed",
        404,
      );
    }

    const normalizedStatus = normalizeAppointmentStatus(
      appointment.status as LegacyAppointmentStatus,
    );
    if (normalizedStatus !== "REQUESTED") {
      throw new AppointmentServiceError(
        "Requested appointment not found or already processed",
        404,
      );
    }
    assertAppointmentStatusTransition(
      appointment.status as LegacyAppointmentStatus,
      "UPCOMING",
      "approveRequestedFromPms",
    );

    const organisationId = appointment.organisationId;

    // Atomic operation (vet availability check + occupancy create)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check overlapping occupancy for lead vet
      const overlapping = await OccupancyModel.findOne({
        userId: extracted.leadVetId,
        organisationId: organisationId,
        startTime: { $lt: appointment.endTime },
        endTime: { $gt: appointment.startTime },
      }).session(session);

      if (overlapping) {
        throw new AppointmentServiceError(
          "Selected vet is not available for this slot",
          409,
        );
      }

      // Create occupancy
      await OccupancyModel.create(
        [
          {
            userId: extracted.leadVetId,
            organisationId,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            sourceType: "APPOINTMENT",
            referenceId: appointment._id.toString(),
          },
        ],
        { session },
      );

      const lead = await UserProfileModel.findOne(
        { userId: extracted.leadVetId },
        { personalDetails: 1 },
      );

      // Apply changes from PMS
      appointment.lead = {
        id: extracted.leadVetId,
        name: extracted.leadVetName ?? "Vet",
        profileUrl:
          lead?.personalDetails?.profilePictureUrl ??
          `https://ui-avatars.com/api/?name=${extracted.leadVetName}`,
      };

      appointment.supportStaff = extracted.supportStaff ?? [];
      appointment.room = extracted.room ?? undefined;

      assertAppointmentStatusTransition(
        appointment.status as LegacyAppointmentStatus,
        "UPCOMING",
        "approveRequestedFromPms",
      );
      appointment.status = "UPCOMING";
      appointment.updatedAt = new Date();

      await appointment.save({ session });
      await session.commitTransaction();
      await session.endSession();

      await syncAppointmentToPostgres(appointment);

      await AuditTrailService.recordSafely({
        organisationId: appointment.organisationId,
        companionId: appointment.companion.id,
        eventType: "APPOINTMENT_APPROVED",
        actorType: "SYSTEM",
        entityType: "APPOINTMENT",
        entityId: appointment._id.toString(),
        metadata: {
          status: appointment.status,
        },
      });

      const notificationPayload = NotificationTemplates.Appointment.APPROVED(
        appointment.companion.name,
        appointment.startTime.toDateString(),
      );

      // Send notification to parent
      const parentId = appointment.companion.parent.id;
      await NotificationService.sendToUser(parentId, notificationPayload);

      const organisationName = await getOrganisationName(
        appointment.organisationId,
      );
      await sendAppointmentAssignmentEmails(appointment, organisationName);

      // Convert final domain → FHIR appointment
      return toAppointmentResponseDTOWithPaymentStatus(appointment);
    } catch (err) {
      await session.abortTransaction();
      await session.endSession();
      throw err;
    }
  },

  // Cancel appointment from PMS or Mobile

  async cancelAppointment(appointmentId: string, reason?: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const appointment =
        await AppointmentModel.findById(appointmentId).session(session);
      if (!appointment) {
        throw new AppointmentServiceError("Appointment not found", 404);
      }

      // Prevent double cancellation
      if (appointment.status === "CANCELLED") {
        await session.abortTransaction();
        await session.endSession();
        return toAppointmentResponseDTOWithPaymentStatus(appointment);
      }

      await InvoiceService.handleAppointmentCancellation(
        appointmentId,
        reason ?? "Cancelled",
      );

      // --- 4. Cancel appointment
      assertAppointmentStatusTransition(
        appointment.status as LegacyAppointmentStatus,
        "CANCELLED",
        "cancelAppointment",
      );
      appointment.status = "CANCELLED";
      appointment.concern = reason ?? appointment.concern;
      appointment.updatedAt = new Date();
      await appointment.save({ session });

      // --- 5. Remove occupancy (if vet was assigned)
      if (appointment.lead?.id) {
        await OccupancyModel.deleteMany({
          organisationId: appointment.organisationId,
          userId: appointment.lead.id,
          referenceId: appointment._id.toString(),
        }).session(session);
      }

      await session.commitTransaction();
      await session.endSession();

      await syncAppointmentToPostgres(appointment);

      await AuditTrailService.recordSafely({
        organisationId: appointment.organisationId,
        companionId: appointment.companion.id,
        eventType: "APPOINTMENT_CANCELLED",
        actorType: "SYSTEM",
        entityType: "APPOINTMENT",
        entityId: appointment._id.toString(),
        metadata: {
          status: appointment.status,
          reason: appointment.concern ?? reason,
        },
      });

      const notificationPayload = NotificationTemplates.Appointment.CANCELLED(
        appointment.companion.name,
      );
      // Send notification to parent
      const parentId = appointment.companion.parent.id;
      await NotificationService.sendToUser(parentId, notificationPayload);
    } catch (err) {
      await session.abortTransaction();
      await session.endSession();
      throw err;
    }
  },

  async cancelAppointmentFromParent(
    appointmentId: string,
    parentId: string,
    reason: string,
  ) {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }

    // Verify parent is owner of companion
    if (appointment.companion.parent.id !== parentId) {
      throw new AppointmentServiceError("Not your appointment", 403);
    }

    // Only these statuses can be cancelled from mobile
    const normalizedStatus = normalizeAppointmentStatus(
      appointment.status as LegacyAppointmentStatus,
    );
    if (!["REQUESTED", "UPCOMING"].includes(normalizedStatus)) {
      throw new AppointmentServiceError(
        "Only requested or upcoming appointments can be cancelled",
        400,
      );
    }
    assertAppointmentStatusTransition(
      appointment.status as LegacyAppointmentStatus,
      "CANCELLED",
      "cancelAppointmentFromParent",
    );

    // Cancel invoice and refund
    const result = await InvoiceService.handleAppointmentCancellation(
      appointment._id.toString(),
      reason ?? "Cancelled",
    );

    if (!result)
      throw new AppointmentServiceError("Not able to cancle appointment", 400);

    // Mark appointment cancelled
    appointment.status = "CANCELLED";
    await appointment.save();
    await syncAppointmentToPostgres(appointment);

    await AuditTrailService.recordSafely({
      organisationId: appointment.organisationId,
      companionId: appointment.companion.id,
      eventType: "APPOINTMENT_CANCELLED",
      actorType: "PARENT",
      actorId: parentId,
      entityType: "APPOINTMENT",
      entityId: appointment._id.toString(),
      metadata: {
        status: appointment.status,
        reason,
      },
    });

    // Remove occupancy (only if vet was assigned)
    if (appointment.lead?.id) {
      await OccupancyModel.deleteMany({
        referenceId: appointment._id.toString(),
        sourceType: "APPOINTMENT",
      });
    }

    return toAppointmentResponseDTOWithPaymentStatus(appointment);
  },

  // PMS Rejects appointment request

  async rejectRequestedAppointment(appointmentId: string, reason?: string) {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found.", 404);
    }

    const normalizedStatus = normalizeAppointmentStatus(
      appointment.status as LegacyAppointmentStatus,
    );
    if (normalizedStatus !== "REQUESTED") {
      throw new AppointmentServiceError(
        "Only REQUESTED appointments can be rejected.",
        400,
      );
    }
    assertAppointmentStatusTransition(
      appointment.status as LegacyAppointmentStatus,
      "CANCELLED",
      "rejectRequestedAppointment",
    );

    const rejectReason = reason! || "Rejected by organisation";

    await InvoiceService.handleAppointmentCancellation(
      appointmentId,
      rejectReason,
    );

    appointment.status = "CANCELLED";
    appointment.concern = rejectReason;
    appointment.updatedAt = new Date();

    await appointment.save();
    await syncAppointmentToPostgres(appointment);

    await AuditTrailService.recordSafely({
      organisationId: appointment.organisationId,
      companionId: appointment.companion.id,
      eventType: "APPOINTMENT_CANCELLED",
      actorType: "SYSTEM",
      entityType: "APPOINTMENT",
      entityId: appointment._id.toString(),
      metadata: {
        status: appointment.status,
        reason: rejectReason,
      },
    });

    const notificationPayload = NotificationTemplates.Appointment.CANCELLED(
      appointment.companion.name,
    );

    // Send notification to parent
    const parentId = appointment.companion.parent.id;
    await NotificationService.sendToUser(parentId, notificationPayload);

    return toAppointmentResponseDTOWithPaymentStatus(appointment);
  },

  // Update appointment from PMS

  async updateAppointmentPMS(
    appointmentId: string,
    dto: AppointmentRequestDTO,
  ) {
    if (!appointmentId) {
      throw new AppointmentServiceError(
        "Appointment ID missing in FHIR payload",
        400,
      );
    }

    const extracted = fromAppointmentRequestDTO(dto);

    if (!extracted.lead?.id) {
      throw new AppointmentServiceError(
        "Lead vet (Practitioner with code=PPRF) is required",
        400,
      );
    }

    const appointment = await AppointmentModel.findById(appointmentId);

    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }

    const allowedStatuses: AppointmentStatus[] = ["REQUESTED", "UPCOMING"];
    const normalizedStatus = normalizeAppointmentStatus(
      appointment.status as LegacyAppointmentStatus,
    );
    if (!allowedStatuses.includes(normalizedStatus)) {
      throw new AppointmentServiceError(
        `Appointment cannot be updated in status ${appointment.status}`,
        409,
      );
    }

    const organisationId = appointment.organisationId;

    const sameVet = appointment.lead?.id === extracted.lead?.id;
    const sameSlot =
      appointment.startTime.getTime() === extracted.startTime?.getTime() &&
      appointment.endTime.getTime() === extracted.endTime?.getTime();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      /**
       * 🔁 ONLY touch occupancy if something actually changed
       */
      if (!sameVet || !sameSlot) {
        // Remove old occupancy (if exists)
        await OccupancyModel.deleteMany(
          {
            organisationId,
            sourceType: "APPOINTMENT",
            referenceId: appointment._id.toString(),
          },
          { session },
        );

        // Check availability for new vet + slot
        const overlapping = await OccupancyModel.findOne({
          userId: extracted.lead?.id,
          organisationId,
          startTime: { $lt: extracted.endTime },
          endTime: { $gt: extracted.startTime },
        }).session(session);

        if (overlapping) {
          throw new AppointmentServiceError(
            "Selected vet is not available for this slot",
            409,
          );
        }

        // Create new occupancy
        await OccupancyModel.create(
          [
            {
              userId: extracted.lead?.id,
              organisationId,
              startTime: extracted.startTime,
              endTime: extracted.endTime,
              sourceType: "APPOINTMENT",
              referenceId: appointment._id.toString(),
            },
          ],
          { session },
        );
      }

      // Apply PMS updates
      appointment.lead = {
        id: extracted.lead?.id,
        name: extracted.lead?.name ?? "Vet",
      };

      appointment.supportStaff = extracted.supportStaff ?? [];
      appointment.room = extracted.room ?? undefined;
      appointment.startTime = extracted.startTime ?? appointment.startTime;
      appointment.endTime = extracted.endTime ?? appointment.endTime;
      appointment.appointmentDate =
        extracted.startTime ?? appointment.appointmentDate;
      appointment.timeSlot = extracted.startTime
        ? dayjs(extracted.startTime).format("HH:mm")
        : appointment.timeSlot;
      appointment.durationMinutes =
        extracted.durationMinutes ?? appointment.durationMinutes;
      appointment.updatedAt = new Date();

      await appointment.save({ session });

      await session.commitTransaction();
      await session.endSession();

      await syncAppointmentToPostgres(appointment);

      return toAppointmentResponseDTOWithPaymentStatus(appointment);
    } catch (err) {
      await session.abortTransaction();
      await session.endSession();
      throw err;
    }
  },

  async attachFormsToAppointment(
    appointmentId: string,
    formIds: string[],
  ): Promise<AppointmentResponseDTO> {
    if (!appointmentId) {
      throw new AppointmentServiceError("Appointment ID is required", 400);
    }

    if (!Array.isArray(formIds) || formIds.length === 0) {
      throw new AppointmentServiceError("formIds are required", 400);
    }

    const uniqueFormIds = Array.from(
      new Set(formIds.map((id) => id?.trim()).filter(Boolean)),
    );

    if (uniqueFormIds.length === 0) {
      throw new AppointmentServiceError("formIds are required", 400);
    }

    const appointmentObjectId = ensureObjectId(appointmentId, "appointmentId");
    const appointment = await AppointmentModel.findById(appointmentObjectId);

    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }

    const formObjectIds = uniqueFormIds.map((id) =>
      ensureObjectId(id, "formId"),
    );

    const forms = await FormModel.find({
      _id: { $in: formObjectIds },
      orgId: appointment.organisationId,
    })
      .select("_id")
      .lean();

    const foundIds = new Set(forms.map((f) => f._id.toString()));
    const missing = uniqueFormIds.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new AppointmentServiceError(
        `Forms not found: ${missing.join(", ")}`,
        404,
      );
    }

    const existingIds = new Set((appointment.formIds ?? []).map(String));
    const newIds = uniqueFormIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      return toAppointmentResponseDTOWithPaymentStatus(appointment);
    }

    const updated = await AppointmentModel.findByIdAndUpdate(
      appointmentObjectId,
      {
        $addToSet: { formIds: { $each: newIds } },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );

    if (!updated) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }
    await syncAppointmentToPostgres(updated);

    for (const formId of newIds) {
      await AuditTrailService.recordSafely({
        organisationId: appointment.organisationId,
        companionId: appointment.companion.id,
        eventType: "FORM_ATTACHED",
        actorType: "SYSTEM",
        entityType: "FORM",
        entityId: formId,
        metadata: {
          appointmentId: appointment._id.toString(),
        },
      });
    }

    return toAppointmentResponseDTOWithPaymentStatus(updated);
  },

  async checkInAppointmentParent(appointmentId: string, parentId: string) {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }

    // Verify parent is owner of companion
    if (appointment.companion.parent.id !== parentId) {
      throw new AppointmentServiceError("Not your appointment", 403);
    }

    // Only UPCOMING appointments can be checked in
    if (appointment.status !== "UPCOMING") {
      throw new AppointmentServiceError(
        "Only upcoming appointments can be checked in",
        400,
      );
    }

    assertAppointmentStatusTransition(
      appointment.status as LegacyAppointmentStatus,
      "CHECKED_IN",
      "checkInAppointmentParent",
    );
    appointment.status = "CHECKED_IN";
    appointment.updatedAt = new Date();
    await appointment.save();
    await syncAppointmentToPostgres(appointment);
    await syncAppointmentToPostgres(appointment);

    await AuditTrailService.recordSafely({
      organisationId: appointment.organisationId,
      companionId: appointment.companion.id,
      eventType: "APPOINTMENT_CHECKED_IN",
      actorType: "PARENT",
      actorId: parentId,
      entityType: "APPOINTMENT",
      entityId: appointment._id.toString(),
      metadata: {
        status: appointment.status,
      },
    });

    return toAppointmentResponseDTOWithPaymentStatus(appointment);
  },

  async checkInAppointment(appointmentId: string) {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }

    // Only UPCOMING appointments can be checked in
    if (appointment.status !== "UPCOMING") {
      throw new AppointmentServiceError(
        "Only upcoming appointments can be checked in",
        400,
      );
    }

    assertAppointmentStatusTransition(
      appointment.status as LegacyAppointmentStatus,
      "CHECKED_IN",
      "checkInAppointment",
    );
    appointment.status = "CHECKED_IN";
    appointment.updatedAt = new Date();
    await appointment.save();

    await AuditTrailService.recordSafely({
      organisationId: appointment.organisationId,
      companionId: appointment.companion.id,
      eventType: "APPOINTMENT_CHECKED_IN",
      actorType: "SYSTEM",
      entityType: "APPOINTMENT",
      entityId: appointment._id.toString(),
      metadata: {
        status: appointment.status,
      },
    });

    return toAppointmentResponseDTOWithPaymentStatus(appointment);
  },

  async rescheduleFromParent(
    appointmentId: string,
    parentId: string,
    changes: {
      startTime: string | Date;
      endTime: string | Date;
      durationMinutes?: number;
      concern?: string;
      isEmergency?: boolean;
    },
  ) {
    const _id = ensureObjectId(appointmentId, "appointmentId");

    const newStart =
      changes.startTime instanceof Date
        ? changes.startTime
        : new Date(changes.startTime);
    const newEnd =
      changes.endTime instanceof Date
        ? changes.endTime
        : new Date(changes.endTime);

    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      throw new AppointmentServiceError("Invalid startTime/endTime", 400);
    }
    if (newStart >= newEnd) {
      throw new AppointmentServiceError(
        "startTime must be before endTime",
        400,
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const existing = await AppointmentModel.findById(_id).session(session);

      if (!existing) {
        throw new AppointmentServiceError("Appointment not found", 404);
      }

      // 1. Auth: ensure this parent owns the appointment
      const existingParentId =
        existing.companion?.parent?.id ?? existing.companion?.parent?.id;

      if (!existingParentId || existingParentId !== parentId) {
        throw new AppointmentServiceError(
          "You are not allowed to modify this appointment.",
          403,
        );
      }

      // 2. Status checks
      const normalizedStatus = normalizeAppointmentStatus(
        existing.status as LegacyAppointmentStatus,
      );
      if (
        normalizedStatus === "COMPLETED" ||
        normalizedStatus === "CANCELLED"
      ) {
        throw new AppointmentServiceError(
          "Completed or cancelled appointments cannot be rescheduled.",
          400,
        );
      }

      let newStatus = normalizedStatus;

      // If appointment was already approved (UPCOMING),
      // move it back to REQUESTED and clear vet/staff/room.
      if (normalizedStatus === "UPCOMING") {
        assertAppointmentStatusTransition(
          existing.status as LegacyAppointmentStatus,
          "REQUESTED",
          "rescheduleFromParent",
        );
        newStatus = "REQUESTED";

        // Clear assignment; PMS will re-assign
        existing.lead = undefined;
        existing.supportStaff = [];
        existing.room = undefined;

        // Remove existing occupancy for this appointment
        await OccupancyModel.deleteMany({
          referenceId: appointmentId,
          sourceType: "APPOINTMENT",
        }).session(session);
      }

      // 3. Apply new time & optional fields
      existing.startTime = newStart;
      existing.endTime = newEnd;
      existing.appointmentDate = newStart;
      existing.timeSlot = dayjs(newStart).format("HH:mm");
      existing.durationMinutes =
        changes.durationMinutes ??
        dayjs(newEnd).diff(dayjs(newStart), "minute");

      if (typeof changes.concern === "string") {
        existing.concern = changes.concern;
      }

      if (typeof changes.isEmergency === "boolean") {
        existing.isEmergency = changes.isEmergency;
      }

      existing.status = newStatus;
      existing.updatedAt = new Date();

      await existing.save({ session });

      await session.commitTransaction();
      await session.endSession();

      await syncAppointmentToPostgres(existing);

      await AuditTrailService.recordSafely({
        organisationId: existing.organisationId,
        companionId: existing.companion.id,
        eventType: "APPOINTMENT_RESCHEDULED",
        actorType: "PARENT",
        actorId: parentId,
        entityType: "APPOINTMENT",
        entityId: existing._id.toString(),
        metadata: {
          status: existing.status,
          startTime: existing.startTime,
          endTime: existing.endTime,
        },
      });

      return toAppointmentResponseDTOWithPaymentStatus(existing);
    } catch (err) {
      await session.abortTransaction();
      await session.endSession();
      if (err instanceof AppointmentServiceError) throw err;
      throw new AppointmentServiceError(
        "Failed to reschedule appointment",
        500,
      );
    }
  },

  async getAppointmentsForCompanion(companionId: string) {
    if (!companionId) {
      throw new AppointmentServiceError("companionId is required", 400);
    }

    const docs: AppointmentMongo[] = await AppointmentModel.find({
      "companion.id": companionId,
    })
      .sort({ startTime: -1 })
      .lean<AppointmentMongo[]>();

    if (docs.length === 0) return [];

    // 2. Extract unique organisationIds
    const orgIds = [
      ...new Set(docs.map((d) => d.organisationId?.toString())),
    ].filter(Boolean);

    // 3. Fetch organisations in one query
    const organisations = await OrganizationModel.find(
      { _id: { $in: orgIds } },
      { name: 1, imageURL: 1, address: 1, phoneNo: 1, googlePlacesId: 1 },
    ).lean();

    // Convert array → map for O(1) lookup
    const orgMap = new Map(
      organisations.map((org) => [org._id.toString(), org]),
    );

    const paymentStatusMap = await buildPaymentStatusMapForDocs(docs);

    return docs.map((doc) => {
      const appointmentId =
        (doc as AppointmentMongo & { _id?: Types.ObjectId })._id?.toString() ??
        "";
      const domainObj = toDomainLean(doc);
      const dto = toAppointmentResponseDTO(
        attachPaymentStatus(
          domainObj,
          paymentStatusMap.get(appointmentId) ?? "UNPAID",
        ),
      );

      // Attach organisation data
      const org = orgMap.get(doc.organisationId?.toString()) ?? null;

      return {
        appointment: dto,
        organisation: org,
      };
    });
  },

  async getAppointmentsForCompanionByOrganisation(
    companionId: string,
    organisationId: string,
  ) {
    if (!companionId) {
      throw new AppointmentServiceError("companionId is required", 400);
    }
    if (!organisationId) {
      throw new AppointmentServiceError("organisationId is required", 400);
    }

    const docs: AppointmentMongo[] = await AppointmentModel.find({
      "companion.id": companionId,
      organisationId,
    })
      .sort({ startTime: -1 })
      .lean<AppointmentMongo[]>();

    const paymentStatusMap = await buildPaymentStatusMapForDocs(docs);

    return docs.map((doc) => {
      const appointmentId =
        (doc as AppointmentMongo & { _id?: Types.ObjectId })._id?.toString() ??
        "";
      const domain = attachPaymentStatus(
        toDomainLean(doc),
        paymentStatusMap.get(appointmentId) ?? "UNPAID",
      );
      return toAppointmentResponseDTO(domain);
    });
  },

  async getById(appointmentId: string): Promise<AppointmentResponseDTO> {
    if (!appointmentId)
      throw new AppointmentServiceError("Appointment ID is required", 400);

    const id = ensureObjectId(appointmentId, "AppointmentId");
    const doc = await AppointmentModel.findById(id);

    if (!doc) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }

    return toAppointmentResponseDTOWithPaymentStatus(doc);
  },

  async getAppointmentsForParent(
    parentId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!parentId) {
      throw new AppointmentServiceError("parentId is required", 400);
    }

    const docs: AppointmentMongo[] = await AppointmentModel.find({
      "companion.parent.id": parentId,
    })
      .sort({ startTime: -1 })
      .lean<AppointmentMongo[]>();

    const paymentStatusMap = await buildPaymentStatusMapForDocs(docs);

    return docs.map((doc) => {
      const appointmentId =
        (doc as AppointmentMongo & { _id?: Types.ObjectId })._id?.toString() ??
        "";
      const domain = attachPaymentStatus(
        toDomainLean(doc),
        paymentStatusMap.get(appointmentId) ?? "UNPAID",
      );
      return toAppointmentResponseDTO(domain);
    });
  },

  async getAppointmentsForOrganisation(
    organisationId: string,
    filters?: {
      status?: AppointmentStatus[];
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<AppointmentResponseDTO[]> {
    if (!organisationId) {
      throw new AppointmentServiceError("organisationId is required", 400);
    }

    const query: FilterQuery<AppointmentMongo> = { organisationId };

    if (filters?.status?.length) {
      query.status = { $in: filters.status };
    }

    if (filters?.startDate || filters?.endDate) {
      const startTimeFilter: DateRangeQuery = {};
      if (filters.startDate) startTimeFilter.$gte = filters.startDate;
      if (filters.endDate) startTimeFilter.$lte = filters.endDate;
      query.startTime = startTimeFilter;
    }

    const docs: AppointmentMongo[] = await AppointmentModel.find(query)
      .sort({ startTime: -1 })
      .lean<AppointmentMongo[]>();

    const paymentStatusMap = await buildPaymentStatusMapForDocs(docs);

    return docs.map((doc) => {
      const appointmentId =
        (doc as AppointmentMongo & { _id?: Types.ObjectId })._id?.toString() ??
        "";
      const domain = attachPaymentStatus(
        toDomainLean(doc),
        paymentStatusMap.get(appointmentId) ?? "UNPAID",
      );
      return toAppointmentResponseDTO(domain);
    });
  },

  async getAppointmentsForLead(
    leadId: string,
    organisationId?: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!leadId) {
      throw new AppointmentServiceError("leadId is required", 400);
    }

    const query: FilterQuery<AppointmentMongo> = { "lead.id": leadId };
    if (organisationId) query.organisationId = organisationId;

    const docs: AppointmentMongo[] = await AppointmentModel.find(query)
      .sort({ startTime: -1 })
      .lean<AppointmentMongo[]>();

    const paymentStatusMap = await buildPaymentStatusMapForDocs(docs);

    return docs.map((doc) => {
      const appointmentId =
        (doc as AppointmentMongo & { _id?: Types.ObjectId })._id?.toString() ??
        "";
      const domain = attachPaymentStatus(
        toDomainLean(doc),
        paymentStatusMap.get(appointmentId) ?? "UNPAID",
      );
      return toAppointmentResponseDTO(domain);
    });
  },

  async getAppointmentsForSupportStaff(
    staffId: string,
    organisationId?: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!staffId) {
      throw new AppointmentServiceError("staffId is required", 400);
    }

    const query: FilterQuery<AppointmentMongo> = { "supportStaff.id": staffId };
    if (organisationId) query.organisationId = organisationId;

    const docs: AppointmentMongo[] = await AppointmentModel.find(query)
      .sort({ startTime: -1 })
      .lean<AppointmentMongo[]>();

    const paymentStatusMap = await buildPaymentStatusMapForDocs(docs);

    return docs.map((doc) => {
      const appointmentId =
        (doc as AppointmentMongo & { _id?: Types.ObjectId })._id?.toString() ??
        "";
      const domain = attachPaymentStatus(
        toDomainLean(doc),
        paymentStatusMap.get(appointmentId) ?? "UNPAID",
      );
      return toAppointmentResponseDTO(domain);
    });
  },

  async getAppointmentsByDateRange(
    organisationId: string,
    startDate: Date,
    endDate: Date,
    status?: AppointmentStatus[],
  ): Promise<AppointmentResponseDTO[]> {
    const query: FilterQuery<AppointmentMongo> = {
      organisationId,
      startTime: { $gte: startDate, $lte: endDate },
    };

    if (status?.length) {
      query.status = { $in: status };
    }

    const docs: AppointmentMongo[] = await AppointmentModel.find(query)
      .sort({ startTime: 1 })
      .lean<AppointmentMongo[]>();

    const paymentStatusMap = await buildPaymentStatusMapForDocs(docs);

    return docs.map((doc) => {
      const appointmentId =
        (doc as AppointmentMongo & { _id?: Types.ObjectId })._id?.toString() ??
        "";
      const domain = attachPaymentStatus(
        toDomainLean(doc),
        paymentStatusMap.get(appointmentId) ?? "UNPAID",
      );
      return toAppointmentResponseDTO(domain);
    });
  },

  async searchAppointments(filter: {
    companionId?: string;
    parentId?: string;
    organisationId?: string;
    leadId?: string;
    staffId?: string;
    status?: AppointmentStatus[];
    startDate?: Date;
    endDate?: Date;
  }): Promise<AppointmentResponseDTO[]> {
    const query: FilterQuery<AppointmentMongo> = {};

    if (filter.companionId) query["companion.id"] = filter.companionId;
    if (filter.parentId) query["companion.parent.id"] = filter.parentId;
    if (filter.organisationId) query.organisationId = filter.organisationId;
    if (filter.leadId) query["lead.id"] = filter.leadId;
    if (filter.staffId) query["supportStaff.id"] = filter.staffId;

    if (filter.status?.length) query.status = { $in: filter.status };

    if (filter.startDate || filter.endDate) {
      const startTimeFilter: DateRangeQuery = {};
      if (filter.startDate) startTimeFilter.$gte = filter.startDate;
      if (filter.endDate) startTimeFilter.$lte = filter.endDate;
      query.startTime = startTimeFilter;
    }

    const docs: AppointmentMongo[] = await AppointmentModel.find(query)
      .sort({ startTime: 1 })
      .lean<AppointmentMongo[]>();

    const paymentStatusMap = await buildPaymentStatusMapForDocs(docs);

    return docs.map((doc) => {
      const appointmentId =
        (doc as AppointmentMongo & { _id?: Types.ObjectId })._id?.toString() ??
        "";
      const domain = attachPaymentStatus(
        toDomainLean(doc),
        paymentStatusMap.get(appointmentId) ?? "UNPAID",
      );
      return toAppointmentResponseDTO(domain);
    });
  },

  async markNoShowAppointments(params?: { graceMinutes?: number }) {
    const graceMinutes = params?.graceMinutes ?? 15;

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - graceMinutes * 60 * 1000);

    /**
     * We ONLY mark:
     * - UPCOMING appointments
     * - whose endTime + grace < now
     */
    const result = await AppointmentModel.updateMany(
      {
        status: "UPCOMING",
        endTime: { $lt: cutoffTime },
      },
      {
        $set: {
          status: "NO_SHOW",
          updatedAt: new Date(),
        },
      },
    );

    if (shouldDualWrite) {
      try {
        await prisma.appointment.updateMany({
          where: {
            status: "UPCOMING",
            endTime: { lt: cutoffTime },
          },
          data: {
            status: "NO_SHOW",
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        handleDualWriteError("Appointment no-show", err);
      }
    }

    return {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    };
  },
};

const createObservationToolTaskForAppointment = async ({
  appointmentId,
  organisationId,
  companionId,
  parentId,
  observationToolId,
  appointmentStartTime,
}: {
  appointmentId: string;
  organisationId: string;
  companionId: string;
  parentId: string;
  observationToolId: string;
  appointmentStartTime: Date;
}) => {
  const dueAt = dayjs(appointmentStartTime).subtract(2, "hour").toDate();

  return TaskService.createCustom({
    organisationId,
    appointmentId,

    companionId,

    createdBy: parentId,
    assignedBy: parentId,
    assignedTo: parentId,

    audience: "PARENT_TASK",

    category: "Observation Tool",
    name: "Complete observation before appointment",
    description:
      "Please complete the observation tool before your scheduled appointment.",
    additionalNotes:
      "This task must be completed before the appointment for proper evaluation.",

    observationToolId,

    dueAt,
    timezone: "UTC",

    reminder: {
      enabled: true,
      offsetMinutes: 60, // remind 1 hour before task due
    },
  });
};
