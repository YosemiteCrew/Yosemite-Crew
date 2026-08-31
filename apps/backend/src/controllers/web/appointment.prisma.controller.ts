import { Request, Response } from "express";
import { z } from "zod";
import { AppointmentRequestDTO } from "@yosemite-crew/types";
import { AppointmentPrismaService } from "src/services/appointment.prisma.service";
import { InvoiceService } from "src/services/invoice.service";
import logger from "src/utils/logger";
import { generatePresignedUrl } from "src/middlewares/upload";
import { resolveVerifiedUserId } from "src/utils/request";
import type { OrgRequest } from "src/middlewares/rbac";
import {
  resolveAuthedParentId,
  sendAppointmentError,
} from "./shared/appointment-controller.helpers";

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

/**
 * The organisation the RBAC middleware authorized the caller against. On
 * resource-scoped routes that is the appointment's own organisation, not
 * whatever the URL named, so it is the only value safe to filter on.
 */
/**
 * The organisation the request BODY names, via its FHIR `Organization`
 * participant.
 *
 * This is the value the write is actually persisted under:
 * `fromFHIRAppointment` (packages/types/src/appointment.ts) reads the same
 * participant into `organisationId`, and that is what reaches
 * `tx.appointment.create`. It is a different source from the one
 * `withOrgPermissions()` authorises, which is why the two must be compared.
 */
const ORGANIZATION_REFERENCE_PREFIX = "Organization/";

/**
 * One organisation id, in one spelling.
 *
 * `withOrgPermissions()` normalizes whitespace and nothing else - see
 * `normalizeOrgId` in middlewares/rbac.ts - so `x-org-id: Organization/org_a`
 * reaches this controller as `"Organization/org_a"`, while the body reference
 * naming that same organisation resolves to `"org_a"`. Comparing the two
 * strictly answered 403 to a caller writing to the tenant it was authorised
 * for, which is the guard refusing valid work rather than catching an escape.
 * Both sides go through here before they meet.
 */
const bareOrganisationId = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.startsWith(ORGANIZATION_REFERENCE_PREFIX)
    ? trimmed.slice(ORGANIZATION_REFERENCE_PREFIX.length).trim()
    : trimmed;
};

/**
 * The subset of an appointment body this tenant guard reads, and no more.
 *
 * Deliberately narrow: the service validates the full payload, and a second
 * definition of a valid appointment here would drift from that one. What the
 * guard cannot afford is to GUESS. `req.body` is `unknown` at runtime whatever
 * the handler's TypeScript annotation claims, and every shape the old manual
 * traversal failed to understand produced `undefined` - indistinguishable from
 * "this body names no organisation", which is the branch that lets a write
 * through with no tenant comparison at all. Parsing turns that silence into a
 * refusal.
 *
 * `participant` is `nullish` because a body genuinely may not carry one, and
 * the service rejects that downstream on its own terms. A participant list
 * that is PRESENT but malformed is a different thing and is refused here.
 */
const tenantGuardBodySchema = z.object({
  participant: z
    .array(
      z.object({
        actor: z.object({ reference: z.string().nullish() }).nullish(),
      }),
    )
    .nullish(),
});

type TenantGuardBody = z.infer<typeof tenantGuardBodySchema>;

const resolveBodyOrganisationId = (
  body: TenantGuardBody,
): string | undefined => {
  for (const participant of body.participant ?? []) {
    const reference = participant.actor?.reference;
    if (
      typeof reference === "string" &&
      reference.startsWith(ORGANIZATION_REFERENCE_PREFIX)
    ) {
      const id = bareOrganisationId(reference);
      if (id) return id;
    }
  }
  return undefined;
};

const resolveAuthorizedOrganisationId = (req: Request): string | undefined => {
  const orgReq = req as OrgRequest;
  const organisationId = orgReq.organisationId ?? orgReq.params?.organisationId;
  return typeof organisationId === "string" && organisationId.trim()
    ? organisationId
    : undefined;
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
      const parentId = await resolveAuthedParentId(req, res);
      if (!parentId) {
        return;
      }

      const data = await AppointmentPrismaService.createRequestedFromMobile(
        req.body,
        parentId,
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
      const parentId = await resolveAuthedParentId(req, res);
      if (!parentId) {
        return;
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
        parentId,
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
      /*
       * Bind the write to the organisation the caller is authorised for.
       *
       * `withOrgPermissions()` proves membership of the org the REQUEST NAMES -
       * params, `x-org-id`, or query. The appointment is persisted under the org
       * its BODY names, read from the FHIR `Organization` participant. Those were
       * two unconnected sources: a caller with `appointments:edit:any` at org A
       * could send `x-org-id: A` to pass the gate and `Organization/B` in the
       * body, and the appointment was written to B.
       *
       * That is not only a stray row. The same body org drives the invoice
       * `bootstrapForAppointment` opens and the ACTIVE `PatientOrganisation`
       * link `linkByParent` creates, which is what grants a practice ongoing
       * access to a companion's records.
       *
       * `withResourceOrgPermissions` (middlewares/rbac.ts) exists for exactly
       * this hazard and its comment describes it, but it derives the tenant from
       * an existing record - and a create has no record yet. So the comparison
       * belongs here, alongside the four sibling handlers in this file that
       * already call `resolveAuthorizedOrganisationId`.
       *
       * A body that names no organisation is left alone: the service already
       * rejects it downstream, and inventing a tenant for an ambiguous request
       * is not this guard's job.
       */
      const authorisedOrganisationId = resolveAuthorizedOrganisationId(req);
      if (!authorisedOrganisationId) {
        return res.status(400).json({ message: "Missing organisationId" });
      }

      // safeParse, not parse: `parseError` in the shared helper has no ZodError
      // branch, so a thrown ZodError would leave here as a 500 carrying the
      // serialised issue list. A body this guard cannot read is a bad request.
      const parsedBody = tenantGuardBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        logger.warn(
          "Rejected an appointment whose participant list could not be read",
        );
        return res.status(400).json({
          message: "The appointment participants are malformed.",
        });
      }

      const bodyOrganisationId = resolveBodyOrganisationId(parsedBody.data);
      if (
        bodyOrganisationId &&
        bodyOrganisationId !== bareOrganisationId(authorisedOrganisationId)
      ) {
        logger.warn(
          "Rejected an appointment naming an organisation the caller is not authorised for",
        );
        return res.status(403).json({
          message:
            "The appointment names a different organisation from the one this request is authorised for.",
        });
      }

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
      const parentId = await resolveAuthedParentId(req, res);
      if (!parentId) {
        return;
      }

      const data = await AppointmentPrismaService.checkInAppointmentParent(
        req.params.appointmentId,
        parentId,
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
      const organisationId = resolveAuthorizedOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "Missing organisationId" });
      }

      const data = await AppointmentPrismaService.checkInAppointment(
        req.params.appointmentId,
        organisationId,
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
      const organisationId = resolveAuthorizedOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "Missing organisationId" });
      }

      const body = admitAppointmentSchema.parse(req.body);

      const data = await AppointmentPrismaService.admitAppointmentToInpatient(
        req.params.appointmentId,
        organisationId,
        {
          admittedAt: body.admittedAt ? new Date(body.admittedAt) : undefined,
          // The admitting user is whoever is signed in and clicked
          // "Convert to Inpatient" (the verified session), never the body.
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
    req: Request<{ appointmentId: string; organisationId: string }>,
    res: Response,
  ) => {
    try {
      await InvoiceService.markAppointmentReadyForBilling(
        req.params.appointmentId,
        {
          organisationId: req.params.organisationId,
          actorUserId: resolveVerifiedUserId(req),
        },
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
    req: Request<{ appointmentId: string; organisationId: string }>,
    res: Response,
  ) => {
    try {
      const invoice = await InvoiceService.reverseAppointmentReadyForBilling(
        req.params.appointmentId,
        {
          organisationId: req.params.organisationId,
          actorUserId: resolveVerifiedUserId(req),
        },
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
      const organisationId = resolveAuthorizedOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "Missing organisationId" });
      }

      const data = await AppointmentPrismaService.attachFormsToAppointment(
        req.params.appointmentId,
        organisationId,
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
      const parentId = await resolveAuthedParentId(req, res);
      if (!parentId) {
        return;
      }

      const data = await AppointmentPrismaService.cancelAppointmentFromParent(
        req.params.appointmentId,
        parentId,
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

  getById: async (
    req: Request<{ appointmentId: string; organisationId?: string }>,
    res: Response,
  ) => {
    try {
      const orgReq = req as OrgRequest;
      const organisationId = resolveAuthorizedOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "Missing organisationId" });
      }

      const actorId = resolveVerifiedUserId(req);
      const canViewAny =
        orgReq.userPermissions?.includes("appointments:view:any") ?? false;

      if (!canViewAny && !actorId) {
        return res.status(403).json({ message: "User not authenticated" });
      }

      const data = await AppointmentPrismaService.getById(
        req.params.appointmentId,
        { organisationId, actorId: canViewAny ? undefined : actorId },
      );
      return res.status(200).json({ data });
    } catch (err: unknown) {
      logger.error("Appointment fetch error", err);
      return sendAppointmentError(res, err, "Failed to fetch appointment");
    }
  },

  getByIdMobile: async (
    req: Request<{ appointmentId: string }>,
    res: Response,
  ) => {
    try {
      const parentId = await resolveAuthedParentId(req, res);
      if (!parentId) {
        return;
      }

      const data = await AppointmentPrismaService.getById(
        req.params.appointmentId,
        { parentId },
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
      const parentId = await resolveAuthedParentId(req, res);
      if (!parentId) {
        return;
      }

      const data =
        await AppointmentPrismaService.getAppointmentsForParent(parentId);
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
      let statuses: unknown[] | undefined;
      if (Array.isArray(status)) {
        statuses = status;
      } else if (typeof status === "string") {
        statuses = [status];
      }

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
      const authUserId = resolveVerifiedUserId(req);
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
