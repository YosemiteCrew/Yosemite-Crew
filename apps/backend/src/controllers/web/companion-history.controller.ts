import { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import {
  CompanionHistoryService,
  CompanionHistoryServiceError,
  type HistoryEntryType,
} from "src/services/companion-history.service";

const ObjectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/);

const ParamsSchema = z.object({
  organisationId: ObjectIdSchema,
  companionId: ObjectIdSchema,
});

const QuerySchema = z.object({
  limit: z
    .preprocess((value) => {
      if (typeof value === "string" && value.trim() !== "") {
        return Number(value);
      }
      if (typeof value === "number") return value;
      return undefined;
    }, z.number().int().positive().max(100).optional())
    .optional(),
  cursor: z.string().optional(),
  types: z.string().optional(),
});

const parseTypes = (value?: string) => {
  if (!value) return undefined;
  const types = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return types.length ? types : undefined;
};

export const CompanionHistoryController = {
  listForCompanion: async (req: Request, res: Response): Promise<Response> => {
    try {
      const paramsResult = ParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(400).json({ message: "Invalid route parameters" });
      }

      const queryResult = QuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({ message: "Invalid query parameters" });
      }

      const types = parseTypes(queryResult.data.types);

      const result = await CompanionHistoryService.listForCompanion({
        organisationId: paramsResult.data.organisationId,
        companionId: paramsResult.data.companionId,
        limit: queryResult.data.limit,
        cursor: queryResult.data.cursor,
        types: types as HistoryEntryType[] | undefined,
      });

      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof CompanionHistoryServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Companion history retrieval failed", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
};
