import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import type { OrgRequest } from "src/middlewares/rbac";
import logger from "../../utils/logger";

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.string().optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
});

export const DeveloperDataController = {
  listAppointments: async (req: Request, res: Response): Promise<void> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      res.status(400).json({ error: "organisationId is required" });
      return;
    }

    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const { limit, status, dateFrom, dateTo } = parsed.data;

    try {
      const where: Record<string, unknown> = { organisationId };
      if (status) where.status = status;
      if (dateFrom ?? dateTo) {
        where.appointmentDate = {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        };
      }

      const rows = await prisma.appointment.findMany({
        where,
        select: {
          id: true,
          organisationId: true,
          patient: true,
          lead: true,
          appointmentType: true,
          room: true,
          appointmentDate: true,
          startTime: true,
          endTime: true,
          timeSlot: true,
          durationMinutes: true,
          status: true,
          isEmergency: true,
          concern: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { appointmentDate: "desc" },
        take: limit,
      });

      res.json({ data: rows, total: rows.length });
    } catch (err) {
      logger.error("DeveloperDataController.listAppointments failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getAppointment: async (req: Request, res: Response): Promise<void> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      res.status(400).json({ error: "organisationId is required" });
      return;
    }

    const { id } = req.params;

    try {
      const row = await prisma.appointment.findFirst({
        where: { id, organisationId },
        select: {
          id: true,
          organisationId: true,
          patient: true,
          lead: true,
          supportStaff: true,
          appointmentType: true,
          room: true,
          appointmentDate: true,
          startTime: true,
          endTime: true,
          timeSlot: true,
          durationMinutes: true,
          status: true,
          isEmergency: true,
          concern: true,
          attachments: true,
          formIds: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!row) {
        res.status(404).json({ error: "Appointment not found" });
        return;
      }

      res.json({ data: row });
    } catch (err) {
      logger.error("DeveloperDataController.getAppointment failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  listPatients: async (req: Request, res: Response): Promise<void> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      res.status(400).json({ error: "organisationId is required" });
      return;
    }

    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const { limit, status } = parsed.data;

    try {
      const links = await prisma.patientOrganisation.findMany({
        where: {
          organisationId,
          status: "ACTIVE",
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              type: true,
              breed: true,
              dateOfBirth: true,
              gender: true,
              photoUrl: true,
              status: true,
              isInsured: true,
              microchipNumber: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      const patients = links
        .map((l) => l.patient)
        .filter((p) => !status || p.status === status);

      res.json({ data: patients, total: patients.length });
    } catch (err) {
      logger.error("DeveloperDataController.listPatients failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getPatient: async (req: Request, res: Response): Promise<void> => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      res.status(400).json({ error: "organisationId is required" });
      return;
    }

    const { id } = req.params;

    try {
      const link = await prisma.patientOrganisation.findFirst({
        where: { patientId: id, organisationId, status: "ACTIVE" },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              type: true,
              breed: true,
              speciesCode: true,
              breedCode: true,
              dateOfBirth: true,
              gender: true,
              photoUrl: true,
              currentWeight: true,
              colour: true,
              allergy: true,
              isNeutered: true,
              microchipNumber: true,
              passportNumber: true,
              isInsured: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!link) {
        res.status(404).json({ error: "Patient not found" });
        return;
      }

      res.json({ data: link.patient });
    } catch (err) {
      logger.error("DeveloperDataController.getPatient failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};
