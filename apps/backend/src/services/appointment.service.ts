import mongoose, { FilterQuery, Types } from "mongoose";
import dayjs from "dayjs";
import AppointmentModel, {
  AppointmentDocument,
  AppointmentMongo,
  AppointmentStatus,
} from "../models/appointment";
import {
  Appointment,
  AppointmentRequestDTO,
  AppointmentResponseDTO,
  fromAppointmentRequestDTO,
  toAppointmentResponseDTO,
} from "@yosemite-crew/types";
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
import logger from "src/utils/logger";
import { sendFreePlanLimitReachedEmail } from "src/utils/org-usage-notifications";
import { AuditTrailService } from "./audit-trail.service";

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

const ensureOrgUsageCounters = async (orgId: Types.ObjectId) =>
  OrgUsageCounters.findOneAndUpdate(
    { orgId },
    { $setOnInsert: { orgId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

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

  const updated = await OrgUsageCounters.updateOne(
    { _id: usage._id, freeLimitReachedAt: null },
    { $set: { freeLimitReachedAt: new Date() } },
  );
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
      const message = toolsLimitReached
        ? "Free plan observation tool appointment limit reached."
        : appointmentsLimitReached
          ? "Free plan appointment limit reached."
          : "Free plan usage limit reached.";

      throw new AppointmentServiceError(message, 403);
    }

    const didReachLimit = await markFreeLimitReachedAt(updated);
    if (didReachLimit) {
      void sendFreePlanLimitReachedEmail({ orgId, usage: updated });
    }
    return { orgId, inc };
  }

  await OrgUsageCounters.findOneAndUpdate(
    { orgId },
    { $inc: inc },
    { new: true },
  );

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
    status: obj.status,
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
    status: obj.status,
    isEmergency: obj.isEmergency ?? undefined,
    concern: obj.concern ?? undefined,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    attachments: obj.attachments,
    formIds: obj.formIds ?? [],
  };
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

    let consentForm = null;

    try {
      consentForm = await FormService.getConsentFormForParent(
        organisationId.toString(),
        { serviceId: serviceId.toString() },
      );
    } catch (err) {
      if (err instanceof FormServiceError && err.statusCode === 404) {
        consentForm = null; // expected case
      } else {
        throw err; // real error
      }
    }

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
      status: "NO_PAYMENT",
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

    if (appointment.formIds?.length) {
      for (const formId of appointment.formIds) {
        await AuditTrailService.recordSafely({
          organisationId: appointment.organisationId,
          companionId: appointment.companion.id,
          eventType: "FORM_ATTACHED",
          actorType: "SYSTEM",
          entityType: "FORM",
          entityId: formId,
          metadata: {
            appointmentId: savedAppointment._id.toString(),
          },
        });
      }
    }

    const paymentIntent = await StripeService.createPaymentIntentForAppointment(
      savedAppointment._id.toString(),
    );

    if (
      service.serviceType === "OBSERVATION_TOOL" &&
      service.observationToolId
    ) {
      await createObservationToolTaskForAppointment({
        appointmentId: savedAppointment._id.toString(),
        organisationId: appointment.organisationId,
        companionId: appointment.companion.id,
        parentId: appointment.companion.parent.id,
        observationToolId: service.observationToolId._id.toString(),
        appointmentStartTime: appointment.startTime,
      });
    }

    return {
      appointment: toAppointmentResponseDTO(toDomain(savedAppointment)),
      paymentIntent,
    };
  },

  // Create an appointment from PMS with paynow and paylater

  async createAppointmentFromPms(
    dto: AppointmentRequestDTO,
    createPayment: boolean,
  ) {
    const input = fromAppointmentRequestDTO(dto);

    // 1️⃣ Validate required fields
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

    // 2️⃣ Validate service
    if (!input.appointmentType?.id) {
      throw new AppointmentServiceError(
        "Service (appointmentType.id) is required.",
        400,
      );
    }
    const serviceId = ensureObjectId(input.appointmentType.id, "serviceId");
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

    let consentForm = null;

    try {
      consentForm = await FormService.getConsentFormForParent(
        organisationId.toString(),
        { serviceId: serviceId.toString() },
      );
    } catch (err) {
      if (err instanceof FormServiceError && err.statusCode === 404) {
        consentForm = null; // expected case
      } else {
        throw err; // real error
      }
    }

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

      status: "NO_PAYMENT",
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
          currency: "usd",
          items: [
            {
              description: appointment.appointmentType?.name ?? "Consultation",
              quantity: 1,
              unitPrice: pricing.baseCost,
              discountPercent: pricing.discountPercent,
            },
          ],
          notes: appointment.concern,
          paymentCollectionMethod: "PAYMENT_LINK"
        },
        session,
      );

      let checkout

      await session.commitTransaction();
      await session.endSession();

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

      if (appointment.formIds?.length) {
        for (const formId of appointment.formIds) {
          await AuditTrailService.recordSafely({
            organisationId: appointment.organisationId,
            companionId: appointment.companion.id,
            eventType: "FORM_ATTACHED",
            actorType: "SYSTEM",
            entityType: "FORM",
            entityId: formId,
            metadata: {
              appointmentId: doc._id.toString(),
            },
          });
        }
      }

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

      if (checkout?.url) {
        const parent = await ParentModel.findById(parentId)
          .select("email firstName lastName")
          .lean();
        const parentName = parent
          ? [parent.firstName, parent.lastName].filter(Boolean).join(" ")
          : undefined;
        const amountText =
          typeof invoice.totalAmount === "number"
            ? `${invoice.currency.toUpperCase()} ${invoice.totalAmount.toFixed(2)}`
            : undefined;
        const appointmentTime = dayjs(appointment.startTime).format(
          "MMM D, YYYY h:mm A",
        );

        if (parent?.email) {
          await sendEmailTemplate({
            to: parent.email,
            templateId: "appointmentPaymentCheckout",
            templateData: {
              parentName,
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
        }
      }

      return {
        appointment: toAppointmentResponseDTO(toDomain(doc)),
        invoice,
        checkout
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

    const appointment = await AppointmentModel.findOne({
      _id: dto.id,
      status: "REQUESTED",
    });

    if (!appointment) {
      throw new AppointmentServiceError(
        "Requested appointment not found or already processed",
        404,
      );
    }

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

      appointment.status = "UPCOMING";
      appointment.updatedAt = new Date();

      await appointment.save({ session });
      await session.commitTransaction();
      await session.endSession();

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
      return toAppointmentResponseDTO(toDomain(appointment));
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
        return toAppointmentResponseDTO(toDomain(appointment));
      }

      await InvoiceService.handleAppointmentCancellation(
        appointmentId,
        reason ?? "Cancelled",
      );

      // --- 4. Cancel appointment
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
    if (!["REQUESTED", "UPCOMING"].includes(appointment.status)) {
      throw new AppointmentServiceError(
        "Only requested or upcoming appointments can be cancelled",
        400,
      );
    }

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

    return toAppointmentResponseDTO(toDomain(appointment));
  },

  // PMS Rejects appointment request

  async rejectRequestedAppointment(appointmentId: string, reason?: string) {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found.", 404);
    }

    if (appointment.status !== "REQUESTED") {
      throw new AppointmentServiceError(
        "Only REQUESTED appointments can be rejected.",
        400,
      );
    }

    const rejectReason = reason! || "Rejected by organisation";

    await InvoiceService.handleAppointmentCancellation(
      appointmentId,
      rejectReason,
    );

    appointment.status = "CANCELLED";
    appointment.concern = rejectReason;
    appointment.updatedAt = new Date();

    await appointment.save();

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

    return toAppointmentResponseDTO(toDomain(appointment));
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

    const appointment = await AppointmentModel.findOne({
      _id: appointmentId,
      status: "UPCOMING",
    });

    if (!appointment) {
      throw new AppointmentServiceError(
        "Requested appointment not found or already processed",
        404,
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
          startTime: { $lt: appointment.endTime },
          endTime: { $gt: appointment.startTime },
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
              startTime: appointment.startTime,
              endTime: appointment.endTime,
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
      appointment.updatedAt = new Date();

      await appointment.save({ session });

      await session.commitTransaction();
      await session.endSession();

      return toAppointmentResponseDTO(toDomain(appointment));
    } catch (err) {
      await session.abortTransaction();
      await session.endSession();
      throw err;
    }
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

    appointment.status = "CHECKED_IN";
    appointment.updatedAt = new Date();
    await appointment.save();

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

    return toAppointmentResponseDTO(toDomain(appointment));
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

    return toAppointmentResponseDTO(toDomain(appointment));
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
      if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
        throw new AppointmentServiceError(
          "Completed or cancelled appointments cannot be rescheduled.",
          400,
        );
      }

      let newStatus = existing.status;

      // If appointment was already approved (UPCOMING),
      // move it back to REQUESTED and clear vet/staff/room.
      if (existing.status === "UPCOMING") {
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

      return toAppointmentResponseDTO(toDomain(existing));
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

    return docs.map((doc) => {
      const domainObj = toDomainLean(doc);
      const dto = toAppointmentResponseDTO(domainObj);

      // Attach organisation data
      const org = orgMap.get(doc.organisationId?.toString()) ?? null;

      return {
        appointment: dto,
        organisation: org,
      };
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

    return toAppointmentResponseDTO(toDomain(doc));
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

    return docs.map((doc) => toAppointmentResponseDTO(toDomainLean(doc)));
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

    return docs.map((doc) => toAppointmentResponseDTO(toDomainLean(doc)));
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

    return docs.map((doc) => toAppointmentResponseDTO(toDomainLean(doc)));
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

    return docs.map((doc) => toAppointmentResponseDTO(toDomainLean(doc)));
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

    return docs.map((doc) => toAppointmentResponseDTO(toDomainLean(doc)));
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

    return docs.map((doc) => toAppointmentResponseDTO(toDomainLean(doc)));
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
