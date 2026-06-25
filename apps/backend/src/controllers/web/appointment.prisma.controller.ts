import { Request, Response } from "express";
import { z } from "zod";
import { AppointmentRequestDTO } from "@yosemite-crew/types";
import { AppointmentPrismaService } from "src/services/appointment.prisma.service";
import { InvoiceService } from "src/services/invoice.service";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import logger from "src/utils/logger";
import { generatePresignedUrl } from "src/middlewares/upload";
import { resolveUserIdFromRequest } from "src/utils/request";
import type { OrgRequest } from "src/middlewares/rbac";

type RescheduleRequestBody = {
  startTime: string | Date;
  endTime: string | Date;
  concern?: string;
  isEmergency?: boolean;
  durationMinutes?: number;
};

type CancelBody = { reason?: string };

type UploadUrlBody = { patientId?: string; mimeType?: string };
type AttachFormsBody = { formIds?: string[] };
type AdmitBody = {
  admittedAt?: string;
  expectedStayDays?: number;
  lead?: {
    id: string;
    name: string;
    profileUrl?: string;
  };
  supportStaff?: Array<{
    id: string;
    name: string;
  }>;
  room?: {
    id: string;
    name: string;
  };
  roomUnitId?: string;
  assignedAt?: string;
  assignedBy?: string;
  assignmentReason?: string;
};

type ErrorWithStatus = Error & { statusCode?: number };

const parseError = (
  err: unknown,
  fallbackMessage: string,
): { status: number; message: string } => {
  const status =
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    typeof (err as ErrorWithStatus).statusCode === "number"
      ? ((err as ErrorWithStatus).statusCode ?? 500)
      : 500;

  const message =
    err instanceof Error && err.message ? err.message : fallbackMessage;

  return { status, message };
};

const sendAppointmentError = (
  res: Response,
  err: unknown,
  fallbackMessage: string,
) => {
  const { status, message } = parseError(err, fallbackMessage);
  return res.status(status).json({ message });
};

const admitAppointmentSchema = z.object({
  admittedAt: z.string().datetime().optional(),
  expectedStayDays: z.number().int().nonnegative().optional(),
  lead: z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      profileUrl: z.string().trim().min(1).optional(),
    })
    .optional(),
  supportStaff: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1),
      }),
    )
    .optional(),
  room: z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
    })
    .optional(),
  roomUnitId: z.string().trim().min(1).optional(),
  assignedAt: z.string().datetime().optional(),
  assignedBy: z.string().trim().min(1).optional(),
  assignmentReason: z.string().trim().min(1).optional(),
});

export const AppointmentController = {
  createRequestedFromMobile: async (
    req: Request<unknown, unknown, AppointmentRequestDTO>,
    res: Response,
  ) => {
    try {
      const data = await AppointmentPrismaService.createRequestedFromMobile(
        req.body,
      );
      return res.status(201).json({ message: "Appointment created", data });
    } catch (err: unknown) {
      logger.error("Appointment creation error", err);
      return sendAppointmentError(res, err, "Failed to create appointment");
    }
  },

  rescheduleFromMobile: async (
    req: Request<{ appointmentId: string }, unknown, RescheduleRequestBody>,
    res: Response,
  ) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      if (!authUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const authUser =
        await AuthUserMobileService.getByProviderUserId(authUserId);
      if (!authUser?.parentId) {
        return res
          .status(400)
          .json({ message: "Parent information missing for user" });
      }

      const { appointmentId } = req.params;
      const { startTime, endTime, concern, isEmergency, durationMinutes } =
        req.body;

      if (!startTime || !endTime) {
        return res
          .status(400)
          .json({ message: "Start time and end time are required" });
      }

      const data = await AppointmentPrismaService.rescheduleFromParent(
        appointmentId,
        authUser.parentId.toString(),
        { startTime, endTime, concern, isEmergency, durationMinutes },
      );

      return res
        .status(200)
        .json({ message: "Rescheduled successfully", data });
    } catch (err: unknown) {
      logger.error("Appointment rescheduling error", err);
      return sendAppointmentError(res, err, "Failed to reschedule appointment");
    }
  },

  createFromPms: async (
    req: Request<unknown, unknown, AppointmentRequestDTO>,
    res: Response,
  ) => {
    try {
      const { createPayment, paymentCollectionMethod } = req.query;
      const shouldCreatePayment =
        createPayment === "true" || createPayment === "1";

      const data = await AppointmentPrismaService.createAppointmentFromPms(
        req.body,
        shouldCreatePayment,
        typeof paymentCollectionMethod === "string"
          ? paymentCollectionMethod
          : undefined,
      );

      return res.status(201).json({ message: "Appointment created", data });
    } catch (err: unknown) {
      logger.error("Appointment creation error", err);
      return sendAppointmentError(
        res,
        err,
        "Failed to create appointment (PMS)",
      );
    }
  },

  acceptRequested: async (
    req: Request<{ appointmentId: string }, unknown, AppointmentRequestDTO>,
    res: Response,
  ) => {
    try {
      const { appointmentId } = req.params;
      const data = await AppointmentPrismaService.approveRequestedFromPms(
        appointmentId,
        req.body,
      );
      return res.status(200).json({ message: "Appointment accepted", data });
    } catch (err: unknown) {
      logger.error("Appointment acceptance error", err);
      return sendAppointmentError(res, err, "Failed to accept appointment");
    }
  },

  rejectRequested: async (
    req: Request<{ appointmentId: string }>,
    res: Response,
  ) => {
    try {
      const { appointmentId } = req.params;
      const data =
        await AppointmentPrismaService.rejectRequestedAppointment(
          appointmentId,
        );
      return res.status(200).json({ message: "Appointment rejected", data });
    } catch (err: unknown) {
      logger.error("Appointment rejection error", err);
      return sendAppointmentError(res, err, "Failed to reject appointment");
    }
  },

  checkInAppointment: async (
    req: Request<{ appointmentId: string }>,
    res: Response,
  ) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      if (!authUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const authUser =
        await AuthUserMobileService.getByProviderUserId(authUserId);
      if (!authUser?.parentId) {
        return res
          .status(400)
          .json({ message: "Parent information missing for user" });
      }

      const data = await AppointmentPrismaService.checkInAppointmentParent(
        req.params.appointmentId,
        authUser.parentId.toString(),
      );

      return res.status(200).json({ message: "Appointment checked in", data });
    } catch (err: unknown) {
      logger.error("Appointment check-in error", err);
      return sendAppointmentError(res, err, "Failed to check-in appointment");
    }
  },

  checkInAppointmentForPMS: async (
    req: Request<{ appointmentId: string }>,
    res: Response,
  ) => {
    try {
      const data = await AppointmentPrismaService.checkInAppointment(
        req.params.appointmentId,
      );
      return res.status(200).json({ message: "Appointment checked in", data });
    } catch (err: unknown) {
      logger.error("Appointment check-in error", err);
      return sendAppointmentError(res, err, "Failed to check-in appointment");
    }
  },

  admitFromPMS: async (
    req: Request<{ appointmentId: string }, unknown, AdmitBody>,
    res: Response,
  ) => {
    try {
      const body = admitAppointmentSchema.parse(req.body);

      const data = await AppointmentPrismaService.admitAppointmentToInpatient(
        req.params.appointmentId,
        {
          admittedAt: body.admittedAt ? new Date(body.admittedAt) : undefined,
          // The admitting user is whoever is signed in and clicked
          // "Convert to Inpatient" (the verified Cognito token), never the body.
          admittedBy: (req as { userId?: string }).userId,
          expectedStayDays: body.expectedStayDays,
          lead: body.lead,
          supportStaff: body.supportStaff,
          room: body.room,
          roomUnitId: body.roomUnitId,
          assignedAt: body.assignedAt ? new Date(body.assignedAt) : undefined,
          assignedBy: body.assignedBy,
          assignmentReason: body.assignmentReason,
        },
      );

      return res.status(200).json({ message: "Appointment admitted", data });
    } catch (err: unknown) {
      logger.error("Appointment admit error", err);
      return sendAppointmentError(res, err, "Failed to admit appointment");
    }
  },

  markReadyForBillingForPMS: async (
    req: Request<{ appointmentId: string }>,
    res: Response,
  ) => {
    try {
      await InvoiceService.markAppointmentReadyForBilling(
        req.params.appointmentId,
        resolveUserIdFromRequest(req),
      );
      return res
        .status(200)
        .json({ message: "Appointment marked ready for billing" });
    } catch (err: unknown) {
      logger.error("Appointment billing readiness error", err);
      return sendAppointmentError(
        res,
        err,
        "Failed to mark appointment ready for billing",
      );
    }
  },

  reverseReadyForBillingForPMS: async (
    req: Request<{ appointmentId: string }>,
    res: Response,
  ) => {
    try {
      const invoice = await InvoiceService.reverseAppointmentReadyForBilling(
        req.params.appointmentId,
        resolveUserIdFromRequest(req),
      );
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      return res.status(200).json({
        message: "Appointment billing readiness reversed",
      });
    } catch (err: unknown) {
      logger.error("Appointment billing readiness reversal error", err);
      return sendAppointmentError(
        res,
        err,
        "Failed to reverse appointment ready for billing",
      );
    }
  },

  updateFromPms: async (
    req: Request<{ appointmentId: string }, unknown, AppointmentRequestDTO>,
    res: Response,
  ) => {
    try {
      const data = await AppointmentPrismaService.updateAppointmentPMS(
        req.params.appointmentId,
        req.body,
      );
      return res.status(200).json({ message: "Appointment updated", data });
    } catch (err: unknown) {
      logger.error("Appointment update error", err);
      return sendAppointmentError(res, err, "Failed to update appointment");
    }
  },

  attachFormsToAppointment: async (
    req: Request<{ appointmentId: string }, unknown, AttachFormsBody>,
    res: Response,
  ) => {
    try {
      const data = await AppointmentPrismaService.attachFormsToAppointment(
        req.params.appointmentId,
        req.body.formIds ?? [],
      );
      return res.status(200).json({ message: "Forms attached", data });
    } catch (err: unknown) {
      logger.error("Attach forms error", err);
      return sendAppointmentError(res, err, "Failed to attach forms");
    }
  },

  cancelFromMobile: async (
    req: Request<{ appointmentId: string }, unknown, CancelBody>,
    res: Response,
  ) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      if (!authUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const authUser =
        await AuthUserMobileService.getByProviderUserId(authUserId);
      if (!authUser?.parentId) {
        return res
          .status(400)
          .json({ message: "Parent information missing for user" });
      }

      const data = await AppointmentPrismaService.cancelAppointmentFromParent(
        req.params.appointmentId,
        authUser.parentId.toString(),
      );

      return res.status(200).json({ message: "Appointment cancelled", data });
    } catch (err: unknown) {
      logger.error("Appointment cancellation error", err);
      return sendAppointmentError(res, err, "Failed to cancel appointment");
    }
  },

  cancelFromPMS: async (
    req: Request<{ appointmentId: string }, unknown, CancelBody>,
    res: Response,
  ) => {
    try {
      const data = await AppointmentPrismaService.cancelAppointment(
        req.params.appointmentId,
      );
      return res.status(200).json({ message: "Appointment cancelled", data });
    } catch (err: unknown) {
      logger.error("Appointment cancellation error", err);
      return sendAppointmentError(res, err, "Failed to cancel appointment");
    }
  },

  getById: async (req: Request<{ appointmentId: string }>, res: Response) => {
    try {
      const typedReq = req as OrgRequest;
      const actorId = resolveUserIdFromRequest(req);
      const canViewAny =
        typedReq.userPermissions?.includes("appointments:view:any") ?? false;

      if (!canViewAny && !actorId) {
        return res.status(403).json({ message: "User not authenticated" });
      }

      const data = await AppointmentPrismaService.getById(
        req.params.appointmentId,
        typedReq.organisationId ?? req.params.organisationId,
        canViewAny ? undefined : actorId,
      );
      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appointment fetch error", err);
      return sendAppointmentError(res, err, "Failed to fetch appointment");
    }
  },

  listByCompanion: async (
    req: Request<{ patientId: string }>,
    res: Response,
  ) => {
    try {
      const data = await AppointmentPrismaService.getAppointmentsForCompanion(
        req.params.patientId,
      );
      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appointment list error", err);
      return sendAppointmentError(res, err, "Failed to fetch appointments");
    }
  },

  listByCompanionForOrganisation: async (
    req: Request<{ organisationId: string; patientId: string }>,
    res: Response,
  ) => {
    try {
      const data =
        await AppointmentPrismaService.getAppointmentsForCompanionByOrganisation(
          req.params.patientId,
          req.params.organisationId,
        );
      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appointment list error", err);
      return sendAppointmentError(res, err, "Failed to fetch appointments");
    }
  },

  listByParent: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      if (!authUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const authUser =
        await AuthUserMobileService.getByProviderUserId(authUserId);
      if (!authUser?.parentId) {
        return res
          .status(400)
          .json({ message: "Parent information missing for user" });
      }

      const data = await AppointmentPrismaService.getAppointmentsForParent(
        authUser.parentId.toString(),
      );
      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appointment list error", err);
      return sendAppointmentError(res, err, "Failed to fetch appointments");
    }
  },

  listByOrganisation: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ) => {
    try {
      const { organisationId } = req.params;
      const { status, startDate, endDate } = req.query;
      const statuses = Array.isArray(status)
        ? status
        : typeof status === "string"
          ? [status]
          : undefined;

      const data =
        await AppointmentPrismaService.getAppointmentsForOrganisation(
          organisationId,
          {
            status: statuses as never,
            startDate:
              typeof startDate === "string" ? new Date(startDate) : undefined,
            endDate:
              typeof endDate === "string" ? new Date(endDate) : undefined,
          },
        );

      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appointment list error", err);
      return sendAppointmentError(res, err, "Failed to fetch appointments");
    }
  },

  listByLead: async (req: Request<{ leadId: string }>, res: Response) => {
    try {
      const data = await AppointmentPrismaService.getAppointmentsForLead(
        req.params.leadId,
      );
      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appointment list error", err);
      return sendAppointmentError(res, err, "Failed to fetch appointments");
    }
  },

  getDocumentUplaodURL: async (
    req: Request<unknown, unknown, UploadUrlBody>,
    res: Response,
  ) => {
    try {
      const { patientId, mimeType } = req.body;
      const authUserId = resolveUserIdFromRequest(req);
      if (!authUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      if (!patientId || !mimeType) {
        return res
          .status(400)
          .json({ message: "patientId and mimeType are required" });
      }

      const upload = await generatePresignedUrl(
        mimeType,
        "custom",
        `appointments/${patientId}`,
      );

      return res.status(200).json({ data: upload });
    } catch (err: unknown) {
      logger.error("Appointment document upload error", err);
      return sendAppointmentError(
        res,
        err,
        "Failed to create document upload URL",
      );
    }
  },
};
