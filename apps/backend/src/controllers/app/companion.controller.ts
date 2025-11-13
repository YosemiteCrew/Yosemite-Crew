import { Request, Response } from "express";
import logger from "../../utils/logger";
import { CompanionService, CompanionServiceError } from "../../services/companion.service";
import type { CompanionRequestDTO } from "@yosemite-crew/types";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { Types } from "mongoose";

type CompanionRequestBody = CompanionRequestDTO | { payload?: unknown } | undefined;

// Validate FHIR
const isCompanionPayload = (payload: unknown): payload is CompanionRequestDTO => {
    return (
        !!payload &&
        typeof payload === "object" &&
        "resourceType" in payload &&
        (payload as { resourceType?: unknown }).resourceType === "Patient"
    );
};

// Resolve User ID
const resolveMobileUserId = (req: Request): string | undefined => {
    const authReq = req as AuthenticatedRequest;
    const headerUserId = req.headers?.["x-user-id"];
    if (typeof headerUserId === "string") return headerUserId;

    return authReq.userId;
};

// extract FHIR
const extractFHIRPayload = (req: Request): CompanionRequestDTO => {
    const body = req.body as CompanionRequestBody;

    if (!body) {
        throw new CompanionServiceError("Request body is required.", 400);
    }

    const payload =
        typeof body === "object" && "payload" in body ? body.payload ?? body : body;

    if (!isCompanionPayload(payload)) {
        throw new CompanionServiceError("Invalid FHIR Patient payload.", 400);
    }

    return payload;
};

export const CompanionController = {
    createCompanionMobile: async (req: Request, res: Response) => {
        try {
            const payload = extractFHIRPayload(req);

            const authUserId = resolveMobileUserId(req);
            if (!authUserId) {
                return res.status(401).json({
                    message: "Authentication required for mobile companion creation.",
                });
            }

            const { response } = await CompanionService.create(payload, {
                authUserId,
            });

            return res.status(201).json(response);
        } catch (error) {
            if (error instanceof CompanionServiceError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            logger.error("Failed to create companion (mobile)", error);
            return res.status(500).json({ message: "Unable to create companion." });
        }
    },

    createCompanionPMS: async (req: Request, res: Response) => {
        try {
            const payload = extractFHIRPayload(req);

            const { parentId } = req.body as { parentId?: string };
            if (!parentId || !Types.ObjectId.isValid(parentId)) {
                return res.status(400).json({
                    message: "Valid parentId is required to create companion through PMS.",
                });
            }

            const { response } = await CompanionService.create(payload, {
                parentMongoId: new Types.ObjectId(parentId),
            });

            return res.status(201).json(response);
        } catch (error) {
            if (error instanceof CompanionServiceError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            logger.error("Failed to create companion (PMS)", error);
            return res.status(500).json({ message: "Unable to create companion." });
        }
    },

    getCompanionById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ message: "Companion ID is required." });
            }

            const result = await CompanionService.getById(id);
            if (!result) {
                return res.status(404).json({ message: "Companion not found." });
            }

            return res.status(200).json(result.response);
        } catch (error) {
            if (error instanceof CompanionServiceError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            logger.error("Failed to fetch companion", error);
            return res.status(500).json({ message: "Unable to fetch companion." });
        }
    },

    updateCompanion: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ message: "Companion ID is required." });
            }

            const payload = extractFHIRPayload(req);
            const result = await CompanionService.update(id, payload);

            if (!result) {
                return res.status(404).json({ message: "Companion not found." });
            }

            return res.status(200).json(result.response);
        } catch (error) {
            if (error instanceof CompanionServiceError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            logger.error("Failed to update companion", error);
            return res.status(500).json({ message: "Unable to update companion." });
        }
    },

    deleteCompanion: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ message: "Companion ID is required." });
            }

            await CompanionService.delete(id);
            return res.status(204).send();
        } catch (error) {
            if (error instanceof CompanionServiceError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            logger.error("Failed to delete companion", error);
            return res.status(500).json({ message: "Unable to delete companion." });
        }
    },

    searchCompanionByName: async (req: Request, res: Response) => {
    try {
        const { name } = req.query;

        if (!name || typeof name !== "string") {
            return res
                .status(400)
                .json({ message: "A valid search name is required." });
        }

        const result = await CompanionService.getByName(name);

        return res.status(200).json(result.responses);
    } catch (error) {
        if (error instanceof CompanionServiceError) {
            return res
                .status(error.statusCode)
                .json({ message: error.message });
        }

        logger.error("Failed to search companion by name", error);
        return res
            .status(500)
            .json({ message: "Unable to search companions." });
        }
    },

};
