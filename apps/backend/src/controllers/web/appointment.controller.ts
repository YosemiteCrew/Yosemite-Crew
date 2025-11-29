import { Request, Response } from "express";
import { AppointmentService } from "src/services/appointment.service";
import { AppointmentRequestDTO } from "@yosemite-crew/types";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import logger from "src/utils/logger";
import { AppointmentStatus } from "src/models/appointment";
import { generatePresignedUrl } from "src/middlewares/upload";

type RescheduleRequestBody = {
  startTime: string | Date;
  endTime: string | Date;
  concern?: string;
  isEmergency?: boolean;
};

type CancelBody = { reason?: string };

type UploadUrlBody = { companionId?: string; mimeType?: string };

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];
  if (headerUserId && typeof headerUserId === "string") {
    return headerUserId;
  }
  return authRequest.userId;
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

export const AppointmentController = {
  createRequestedFromMobile: async (
    req: Request<unknown, unknown, AppointmentRequestDTO>,
    res: Response,
  ) => {
    try {
      const dto = req.body;

      const result = await AppointmentService.createRequestedFromMobile(dto);

      return res
        .status(201)
        .json({ message: "Appointment created", data: result });
    } catch (err: unknown) {
      logger.error("Appiontement creation error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to create appointment",
      );
      return res.status(status).json({
        message,
      });
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

      const { startTime, endTime, concern, isEmergency } = req.body;

      if (!startTime || !endTime) {
        return res
          .status(400)
          .json({ message: "Start time and end time are required" });
      }

      const result = await AppointmentService.rescheduleFromParent(
        appointmentId,
        authUser.parentId.toString(),
        { startTime, endTime, concern, isEmergency },
      );

      return res
        .status(200)
        .json({ message: "Rescheduled successfully", data: result });
    } catch (err: unknown) {
      logger.error("Appiontement rescheduling error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to reschedule appointment",
      );
      return res.status(status).json({
        message,
      });
    }
  },

  createFromPms: async (
    req: Request<unknown, unknown, AppointmentRequestDTO>,
    res: Response,
  ) => {
    try {
      const dto = req.body;
      const { createPayment } = req.query;

      const shouldCreatePayment =
        createPayment === "true" || createPayment === "1";

      const result = await AppointmentService.createAppointmentFromPms(
        dto,
        shouldCreatePayment,
      );

      return res
        .status(201)
        .json({ message: "Appointment created", data: result });
    } catch (err: unknown) {
      logger.error("Appiontement creation error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to create appointment (PMS)",
      );
      return res.status(status).json({
        message,
      });
    }
  },

  acceptRequested: async (
    req: Request<{ appointmentId: string }, unknown, AppointmentRequestDTO>,
    res: Response,
  ) => {
    try {
      const { appointmentId } = req.params;
      const dto = req.body; // partial FHIR update fields

      const result = await AppointmentService.approveRequestedFromPms(
        appointmentId,
        dto,
      );

      return res
        .status(200)
        .json({ message: "Appointment accepted", data: result });
    } catch (err: unknown) {
      logger.error("Appiontement acceptance error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to accept appointment",
      );
      return res.status(status).json({
        message,
      });
    }
  },

  rejectRequested: async (
    req: Request<{ appointmentId: string }>,
    res: Response,
  ) => {
    try {
      const { appointmentId } = req.params;

      const result =
        await AppointmentService.rejectRequestedAppointment(appointmentId);

      return res
        .status(200)
        .json({ message: "Appointment rejected", data: result });
    } catch (err: unknown) {
      logger.error("Appiontement rejection error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to reject appointment",
      );
      return res.status(status).json({
        message,
      });
    }
  },

  updateFromPms: async (
    req: Request<{ appointmentId: string }, unknown, AppointmentRequestDTO>,
    res: Response,
  ) => {
    try {
      const { appointmentId } = req.params;
      const dto = req.body; // FHIR partial update request

      const result = await AppointmentService.updateAppointmentPMS(
        appointmentId,
        dto,
      );

      return res
        .status(200)
        .json({ message: "Appointment updated", data: result });
    } catch (err: unknown) {
      logger.error("Appiontement udpation error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to update appointment",
      );
      return res.status(status).json({
        message,
      });
    }
  },

  cancelFromMobile: async (
    req: Request<{ appointmentId: string }, unknown, CancelBody>,
    res: Response,
  ) => {
    try {
      const { appointmentId } = req.params;
      const { reason } = req.body;
      const result = await AppointmentService.cancelAppointment(
        appointmentId,
        reason,
      );

      return res.status(200).json({
        message: "Appointment cancelled successfully",
        data: result,
      });
    } catch (err: unknown) {
      logger.error("Parent cancellation error:", err);
      const { status, message } = parseError(
        err,
        "Failed to cancel appointment",
      );
      return res.status(status).json({
        message,
      });
    }
  },

  cancelFromPMS: async (
    req: Request<{ appointmentId: string }>,
    res: Response,
  ) => {
    try {
      const { appointmentId } = req.params;

      const result = await AppointmentService.cancelAppointment(appointmentId);

      return res.status(200).json({
        message: "Appointment cancelled successfully",
        data: result,
      });
    } catch (err: unknown) {
      logger.error("PMS cancellation error:", err);
      const { status, message } = parseError(
        err,
        "Failed to cancel appointment",
      );
      return res.status(status).json({
        message,
      });
    }
  },

  getById: async (req: Request<{ appointmentId: string }>, res: Response) => {
    try {
      const { appointmentId } = req.params;

      const result = await AppointmentService.getById(appointmentId);

      return res.status(200).json({ data: result });
    } catch (err: unknown) {
      logger.error("Appiontement search error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to fetch appointment",
      );
      return res.status(status).json({
        message,
      });
    }
  },

  listByCompanion: async (
    req: Request<{ companionId: string }>,
    res: Response,
  ) => {
    try {
      const { companionId } = req.params;

      const data =
        await AppointmentService.getAppointmentsForCompanion(companionId);

      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appiontement search error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to fetch appointments",
      );
      return res.status(status).json({ message });
    }
  },

  listByParent: async (req: Request<{ parentId: string }>, res: Response) => {
    try {
      const { parentId } = req.params;

      const data = await AppointmentService.getAppointmentsForParent(parentId);

      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appiontement search error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to fetch appointments",
      );
      return res.status(status).json({ message });
    }
  },

  listByOrganisation: async (
    req: Request<
      { organisationId: string },
      unknown,
      unknown,
      { status?: string | string[]; startDate?: string; endDate?: string }
    >,
    res: Response,
  ) => {
    try {
      const { organisationId } = req.params;
      const { status, startDate, endDate } = req.query;

      const data = await AppointmentService.getAppointmentsForOrganisation(
        organisationId,
        {
          status: Array.isArray(status)
            ? (status.map(String) as AppointmentStatus[])
            : typeof status === "string"
              ? (status.split(",") as AppointmentStatus[])
              : undefined,
          startDate:
            typeof startDate === "string" || typeof startDate === "number"
              ? new Date(startDate)
              : undefined,
          endDate:
            typeof endDate === "string" || typeof endDate === "number"
              ? new Date(endDate)
              : undefined,
        },
      );

      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appiontement search error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to fetch organisation appointments",
      );
      return res.status(status).json({ message });
    }
  },

  listByLead: async (req: Request<{ leadId: string }>, res: Response) => {
    try {
      const { leadId } = req.params;

      const data = await AppointmentService.getAppointmentsForLead(leadId);

      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appiontement search error: ", err);
      const { status, message } = parseError(
        err,
        "Failed to fetch lead appointments",
      );
      return res.status(status).json({ message });
    }
  },

  getDocumentUplaodURL: async (
    req: Request<unknown, unknown, UploadUrlBody>,
    res: Response,
  ) => {
    try {
      const { companionId, mimeType } = req.body;

      if (!companionId || !mimeType) {
        return res
          .status(400)
          .json({ message: "companionId and mimeType are required." });
      }

      const { url, key } = await generatePresignedUrl(
        mimeType,
        "companion",
        companionId,
      );

      return res.status(200).json({ url, key });
    } catch (error) {
      logger.error("Failed to generate upload URL", error);
      return res
        .status(500)
        .json({ message: "Failed to generate upload URL." });
    }
  },
};
