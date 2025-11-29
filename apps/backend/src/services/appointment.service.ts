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
    const organisationId = ensureObjectId(input.organisationId, "organisationId");
    const service = await ServiceModel.findOne({
      _id: serviceId,
      organisationId: organisationId,
      isActive: true,
    });

    if (!service) {
      throw new AppointmentServiceError("Invalid service selected", 404);
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

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const persistable = toPersistable(appointment);
    const savedAppointment = await AppointmentModel.create(persistable);

    // Create Invoice (awaiting payment)
    const invoice = await InvoiceService.createDraftForAppointment({
      appointmentId: savedAppointment._id.toString(),
      parentId: savedAppointment.companion.parent.id,
      organisationId: savedAppointment.organisationId,
      companionId: savedAppointment.companion.id,
      currency: "USD",
      items: [
        {
          description: service.name,
          quantity: 1,
          unitPrice: service.cost,
          discountPercent: service.maxDiscount ?? undefined,
        },
      ],
      notes: input.concern,
    });

    // Create Stripe checkout session or payment intent
    const paymentIntent = await StripeService.createPaymentIntentForInvoice(
      invoice._id.toString(),
    );

    return {
      appointment: toAppointmentResponseDTO(toDomain(savedAppointment)),
      invoice,
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
    const organisationId = ensureObjectId(input.organisationId, "organisationId");
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

      const invoice = await InvoiceService.createDraftForAppointment({
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
      });

      let paymentIntentData = null;

      // 4.5 Optional — create PaymentIntent (ONLY if PMS wants immediate payment)
      if (createPayment === true) {
        paymentIntentData = await StripeService.createPaymentIntentForInvoice(
          invoice._id.toString(),
        );
      }

      await session.commitTransaction();
      await session.endSession();

      return {
        appointment: toAppointmentResponseDTO(toDomain(doc)),
        invoice,
        payment: paymentIntentData,
      };
    } catch (err) {
      await session.abortTransaction();
      await session.endSession();
      if (err instanceof AppointmentServiceError) throw err;
      throw new AppointmentServiceError("Unable to create appointment", 500);
    }
  },

  // Aprprove Appointment from PMS (REUQUESTED -> UPCOMING)

  async approveRequestedFromPms(
    appointmentId: string,
    dto: AppointmentRequestDTO,
  ) {
    if (appointmentId) {
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

      // Apply changes from PMS
      appointment.lead = {
        id: extracted.leadVetId,
        name: extracted.leadVetName ?? "Vet",
      };

      appointment.supportStaff = extracted.supportStaff ?? [];
      appointment.room = extracted.room ?? undefined;

      appointment.status = "UPCOMING";
      appointment.updatedAt = new Date();

      await appointment.save({ session });
      await session.commitTransaction();
      await session.endSession();

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
    return toAppointmentResponseDTO(toDomain(appointment));
  },

  // Update appointment from PMS

  async updateAppointmentPMS(
    appointmentId: string,
    dto: AppointmentRequestDTO,
  ) {
    if (appointmentId) {
      throw new AppointmentServiceError(
        "Appointment ID missing in FHIR payload",
        400,
      );
    }

    const extracted = extractApprovalFieldsFromFHIR(dto);

    if (!extracted.leadVetId) {
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

      // Apply changes from PMS
      appointment.lead = {
        id: extracted.leadVetId,
        name: extracted.leadVetName ?? "Vet",
      };

      appointment.supportStaff = extracted.supportStaff ?? [];
      appointment.room = extracted.room ?? undefined;

      appointment.status = "UPCOMING";
      appointment.updatedAt = new Date();

      await appointment.save({ session });
      await session.commitTransaction();
      await session.endSession();

      // Convert final domain → FHIR appointment
      return toAppointmentResponseDTO(toDomain(appointment));
    } catch (err) {
      await session.abortTransaction();
      await session.endSession();
      throw err;
    }
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
        ? new Date(changes.startTime.getTime())
        : new Date(changes.startTime);
    const newEnd =
      changes.endTime instanceof Date
        ? new Date(changes.endTime.getTime())
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

  async getAppointmentsForCompanion(
    companionId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!companionId) {
      throw new AppointmentServiceError("companionId is required", 400);
    }

    const docs: AppointmentMongo[] = await AppointmentModel.find({
      "companion.id": companionId,
    })
      .sort({ startTime: -1 })
      .lean<AppointmentMongo[]>();

    return docs.map((doc) => toAppointmentResponseDTO(toDomainLean(doc)));
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
};
