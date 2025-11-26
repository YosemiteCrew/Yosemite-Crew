import { Request, Response } from "express";
import {
  ServiceService,
  ServiceServiceError,
} from "../../services/service.service";
import logger from "../../utils/logger";
import { ServiceRequestDTO } from "@yosemite-crew/types";

export const ServiceController = {
  createService: async (req: Request, res: Response) => {
    try {
      const serviceRequest = req.body as ServiceRequestDTO;
      const service = await ServiceService.create(serviceRequest);
      return res.status(201).json(service);
    } catch (error) {
      if (error instanceof ServiceServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to create service", error);
      return res.status(500).json({ message: "Unable to create service." });
    }
  },

  updateService: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const serviceRequest = req.body as ServiceRequestDTO;
      const updated = await ServiceService.update(id, serviceRequest);
      return res.status(200).json(updated);
    } catch (error) {
      if (error instanceof ServiceServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to update service", error);
      return res.status(500).json({ message: "Unable to update service." });
    }
  },

  deleteService: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await ServiceService.delete(id);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof ServiceServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to delete service", error);
      return res.status(500).json({ message: "Unable to delete service." });
    }
  },

  getServiceById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const service = await ServiceService.getById(id);

      if (!service) {
        return res.status(404).json({ message: "Service not found." });
      }

      return res.status(200).json(service);
    } catch (error) {
      if (error instanceof ServiceServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to fetch service", error);
      return res.status(500).json({ message: "Unable to fetch service." });
    }
  },

  listServicesBySpeciality: async (req: Request, res: Response) => {
    try {
      const { specialityId } = req.params;

      const services = await ServiceService.listBySpeciality(specialityId);

      return res.status(200).json(services);
    } catch (error) {
      if (error instanceof ServiceServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list services by speciality", error);
      return res.status(500).json({ message: "Unable to fetch services." });
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
    } catch (error) {
      if (error instanceof ServiceServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list organisation by service", error);
      return res
        .status(500)
        .json({ message: "Unable to fetch organisations." });
    }
  },
};
