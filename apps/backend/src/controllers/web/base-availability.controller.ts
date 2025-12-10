import { type Request, type Response } from "express";
import logger from "../../utils/logger";
import {
  BaseAvailabilityService,
  BaseAvailabilityServiceError,
  type CreateBaseAvailabilityPayload,
  type UpdateBaseAvailabilityPayload,
} from "../../services/base-availability.service";

type CreateAvailabilityRequest = Request<
  Record<string, never>,
  unknown,
  unknown
>;
type UpdateAvailabilityRequest = Request<{ userId: string }, unknown, unknown>;
type GetAvailabilityRequest = Request<{ userId: string }>;

function ensureBodyObject(
  body: unknown,
): asserts body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BaseAvailabilityServiceError("Invalid request body.", 400);
  }
}

export const BaseAvailabilityController = {
  create: async (req: CreateAvailabilityRequest, res: Response) => {
    try {
      const requestBody: unknown = req.body;
      ensureBodyObject(requestBody);

      const availability = await BaseAvailabilityService.create(
        requestBody as CreateBaseAvailabilityPayload,
      );
      res.status(201).json(availability);
    } catch (error: unknown) {
      if (error instanceof BaseAvailabilityServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to create base availability", error);
      res.status(500).json({ message: "Unable to create base availability." });
    }
  },

  update: async (req: UpdateAvailabilityRequest, res: Response) => {
    try {
      const requestBody: unknown = req.body;
      ensureBodyObject(requestBody);

      const availability = await BaseAvailabilityService.update(
        req.params.userId,
        requestBody as UpdateBaseAvailabilityPayload,
      );

      res.status(200).json(availability);
    } catch (error: unknown) {
      if (error instanceof BaseAvailabilityServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to update base availability", error);
      res.status(500).json({ message: "Unable to update base availability." });
    }
  },

  getByUserId: async (req: GetAvailabilityRequest, res: Response) => {
    try {
      const availability = await BaseAvailabilityService.getByUserId(
        req.params.userId,
      );

      if (!availability.length) {
        res.status(404).json({ message: "Base availability not found." });
        return;
      }

      res.status(200).json(availability);
    } catch (error: unknown) {
      if (error instanceof BaseAvailabilityServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to retrieve base availability", error);
      res
        .status(500)
        .json({ message: "Unable to retrieve base availability." });
    }
  },
};
