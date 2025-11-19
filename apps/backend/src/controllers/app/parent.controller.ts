import { Request, Response } from "express"
import logger from "../../utils/logger"
import {
  ParentService,
  ParentServiceError,
} from "../../services/parent.service"
import type { ParentRequestDTO } from "@yosemite-crew/types"
import { AuthenticatedRequest } from "src/middlewares/auth"
import { generatePresignedUrl } from "src/middlewares/upload"

// Resolve UserID
const resolveUserIdFromRequest = (req: Request): string | undefined => {
		const authRequest = req as AuthenticatedRequest
		const headerUserId = req.headers?.['x-user-id']
		if (typeof headerUserId === 'string') {
				return headerUserId
		}
		return authRequest.userId
}

// Payload checker
type ParentRequestBody = ParentRequestDTO | { payload?: unknown } | undefined

const isParentPayload = (payload: unknown): payload is ParentRequestDTO => {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "resourceType" in payload &&
    (payload as { resourceType?: unknown }).resourceType === "RelatedPerson"
  )
}

// Extract FHIR Payload
const extractFHIRPayload = (req: Request): ParentRequestDTO => {
  const body = req.body as ParentRequestBody

  if (!body) {
    throw new ParentServiceError("Request body is required.", 400)
  }

  const payload =
    typeof body === "object" && "payload" in body
      ? (body.payload ?? body)
      : body

  if (!isParentPayload(payload)) {
    throw new ParentServiceError("Invalid FHIR RelatedPerson payload.", 400)
  }

  return payload
}

export const ParentController = {
  /* ========================================================================
   *  MOBILE CONTROLLERS  (requires req.auth.userId)
   * ======================================================================*/
  createParentMobile: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req)
      if (!authUserId) {
        return res.status(401).json({ message: "Authentication required" })
      }

      const payload = extractFHIRPayload(req)
      const result = await ParentService.create(payload, {
        source: "mobile",
        authUserId,
      })

      return res.status(201).json(result.response)
    } catch (error) {
      if (error instanceof ParentServiceError) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      logger.error("Failed to create parent (mobile)", error)
      return res.status(500).json({ message: "Unable to create parent." })
    }
  },

  getParentMobile: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req)
      if (!authUserId) {
        return res.status(401).json({ message: "Authentication required" })
      }

      const { id } = req.params
      if (!id) {
        return res.status(400).json({ message: "Parent ID is required." })
      }

      const result = await ParentService.get(id, {
        source: "mobile",
        authUserId,
      })

      if (!result) {
        return res.status(404).json({ message: "Parent not found." })
      }

      return res.status(200).json(result.response)
    } catch (error) {
      if (error instanceof ParentServiceError) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      logger.error("Failed to fetch parent (mobile)", error)
      return res.status(500).json({ message: "Unable to fetch parent." })
    }
  },

  updateParentMobile: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req)
      if (!authUserId) {
        return res.status(401).json({ message: "Authentication required" })
      }

      const { id } = req.params
      if (!id) {
        return res.status(400).json({ message: "Parent ID is required." })
      }

      const payload = extractFHIRPayload(req)

      const result = await ParentService.update(id, payload, {
        source: "mobile",
        authUserId,
      })

      if (!result) {
        return res.status(404).json({ message: "Parent not found." })
      }

      return res.status(200).json(result.response)
    } catch (error) {
      if (error instanceof ParentServiceError) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      logger.error("Failed to update parent (mobile)", error)
      return res.status(500).json({ message: "Unable to update parent." })
    }
  },

  deleteParentMobile: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req)
      if (!authUserId) {
        return res.status(401).json({ message: "Authentication required" })
      }

      const { id } = req.params
      if (!id) {
        return res.status(400).json({ message: "Parent ID is required." })
      }

      const deleted = await ParentService.delete(id, {
        source: "mobile",
        authUserId,
      })

      if (!deleted) {
        return res.status(404).json({ message: "Parent not found." })
      }

      return res.status(204).send()
    } catch (error) {
      if (error instanceof ParentServiceError) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      logger.error("Failed to delete parent (mobile)", error)
      return res.status(500).json({ message: "Unable to delete parent." })
    }
  },

  // No Auth UserID for PMS
  createParentPMS: async (req: Request, res: Response) => {
    try {
      const payload = extractFHIRPayload(req)

      const result = await ParentService.create(payload, {
        source: "pms",
      })

      return res.status(201).json(result.response)
    } catch (error) {
      if (error instanceof ParentServiceError) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      logger.error("Failed to create parent (PMS)", error)
      return res.status(500).json({ message: "Unable to create parent." })
    }
  },

  getParentPMS: async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      if (!id) {
        return res.status(400).json({ message: "Parent ID is required." })
      }

      const result = await ParentService.get(id, {
        source: "pms",
      })

      if (!result) {
        return res.status(404).json({ message: "Parent not found." })
      }

      return res.status(200).json(result.response)
    } catch (error) {
      if (error instanceof ParentServiceError) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      logger.error("Failed to fetch parent (PMS)", error)
      return res.status(500).json({ message: "Unable to fetch parent." })
    }
  },

  updateParentPMS: async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      if (!id) {
        return res.status(400).json({ message: "Parent ID is required." })
      }

      const payload = extractFHIRPayload(req)

      const result = await ParentService.update(id, payload, {
        source: "pms",
      })

      if (!result) {
        return res.status(404).json({ message: "Parent not found." })
      }

      return res.status(200).json(result.response)
    } catch (error) {
      if (error instanceof ParentServiceError) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      logger.error("Failed to update parent (PMS)", error)
      return res.status(500).json({ message: "Unable to update parent." })
    }
  },

  deleteParentPMS: async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      if (!id) {
        return res.status(400).json({ message: "Parent ID is required." })
      }

      const deleted = await ParentService.delete(id, {
        source: "pms",
      })

      if (!deleted) {
        return res.status(404).json({ message: "Parent not found." })
      }

      return res.status(204).send()
    } catch (error) {
      if (error instanceof ParentServiceError) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      logger.error("Failed to delete parent (PMS)", error)
      return res.status(500).json({ message: "Unable to delete parent." })
    }
  },

  searchByName: async (req: Request, res: Response) => {
      try {
          const { name } = req.query;
  
          if (!name || typeof name !== "string") {
              return res
                  .status(400)
                  .json({ message: "A valid search name is required." });
          }
  
          const result = await ParentService.getByName(name);
  
          return res.status(200).json(result.responses);
      } catch (error) {
          if (error instanceof ParentServiceError) {
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

  getProfileUploadUrl: async (req: Request, res: Response) => {
    try {
        const rawBody: unknown = req.body
        const mimeType =
                typeof rawBody === 'object' && rawBody !== null && 'mimeType' in rawBody
                    ? (rawBody as { mimeType?: unknown }).mimeType
                    : undefined

          if (typeof mimeType !== 'string' || !mimeType) {
              res.status(400).json({ message: 'MIME type is required in the request body.' })
              return
          }

        const { url, key } = await generatePresignedUrl(mimeType, 'temp')

        return res.status(200).json({ url, key });

    } catch (error) {
        logger.error("Failed to generate pre-signed URL", error);
        return res.status(500).json({ message: "Failed to generate upload URL." });
    }
  }
    
}
