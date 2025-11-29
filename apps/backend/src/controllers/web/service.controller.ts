import { Request, Response } from "express";
import {
  ServiceService,
  ServiceServiceError,
} from "../../services/service.service";
import logger from "../../utils/logger";
import { ServiceRequestDTO } from "@yosemite-crew/types";

type BookableSlotsPayload = {
  serviceId: string;
  organisationId: string;
  date: string;
};

const handleError = (error: unknown, res: Response, defaultMessage: string) => {
  if (error instanceof ServiceServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(defaultMessage, error);
  return res.status(500).json({ message: defaultMessage });
};

export const ServiceController = {
  createService: async (
    req: Request<unknown, unknown, ServiceRequestDTO>,
    res: Response,
  ) => {
    try {
      const serviceRequest = req.body;
      const service = await ServiceService.create(serviceRequest);
      return res.status(201).json(service);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to create service.");
    }
  },

  updateService: async (
    req: Request<{ id: string }, unknown, ServiceRequestDTO>,
    res: Response,
  ) => {
    try {
      const { id } = req.params;
      const serviceRequest = req.body;
      const updated = await ServiceService.update(id, serviceRequest);
      return res.status(200).json(updated);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to update service.");
    }
  },

  deleteService: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      await ServiceService.delete(id);
      return res.status(204).send();
    } catch (error: unknown) {
      return handleError(error, res, "Unable to delete service.");
    }
  },

  getServiceById: async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;

      const service = await ServiceService.getById(id);

      if (!service) {
        return res.status(404).json({ message: "Service not found." });
      }

      return res.status(200).json(service);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to fetch service.");
    }
  },

  listServicesBySpeciality: async (req: Request, res: Response) => {
    try {
      const { specialityId } = req.params;

      const services = await ServiceService.listBySpeciality(specialityId);

      return res.status(200).json(services);
    } catch (error: unknown) {
      return handleError(error, res, "Unable to fetch services by speciality.");
    }
  },

  listOrganisationByServiceName: async (req: Request, res: Response) => {
    try {
      const { serviceName } = req.query;

      if (!serviceName || typeof serviceName !== "string") {
        return res
          .status(400)
          .json({ message: "Query paramter serviceName is reqired." });
      }

      const results =
        await ServiceService.listOrganisationsProvidingService(serviceName);
      return res.status(200).json(results);
    } catch (error: unknown) {
      return handleError(
        error,
        res,
        "Unable to fetch organisations by service.",
      );
    }
  },

  getBookableSlotsForService: async (
    req: Request<unknown, unknown, BookableSlotsPayload>,
    res: Response,
  ) => {
    try {
      const { serviceId, organisationId, date } = req.body;

      if (!serviceId || !organisationId || !date) {
        return res.status(400).json({
          success: false,
          message: "serviceId, organisationId and date are required",
        });
      }

      const referenceDate = new Date(date);
      if (Number.isNaN(referenceDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format (use YYYY-MM-DD)",
        });
      }

      const result = await ServiceService.getBookableSlotsService(
        serviceId,
        organisationId,
        referenceDate,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      return handleError(error, res, "Unable to fetch bookable slots");
    }
  },
};
