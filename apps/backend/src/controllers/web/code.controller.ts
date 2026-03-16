import { Request, Response } from "express";
import { CodeService, CodeServiceError } from "src/services/code.service";
import type { CodeSystem, CodeType } from "src/models/code-entry";
import logger from "src/utils/logger";

const parseBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined) return undefined;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
};

export const CodeController = {
  async listEntries(req: Request, res: Response) {
    try {
      const system = req.query.system as CodeSystem | undefined;
      const type = req.query.type as CodeType | undefined;
      const active = parseBoolean(req.query.active);
      const query = req.query.q as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const list = await CodeService.listEntries({
        system,
        type,
        active,
        query,
        limit: Number.isFinite(limit) ? limit : undefined,
      });

      return res.status(200).json(list);
    } catch (error) {
      if (error instanceof CodeServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list code entries", error);
      return res.status(500).json({ message: "Failed to list code entries." });
    }
  },

  async listMappings(req: Request, res: Response) {
    try {
      const sourceSystem = req.query.sourceSystem as CodeSystem | undefined;
      const sourceCode = req.query.sourceCode as string | undefined;
      const targetSystem = req.query.targetSystem as CodeSystem | undefined;
      const targetCode = req.query.targetCode as string | undefined;
      const active = parseBoolean(req.query.active);

      const list = await CodeService.listMappings({
        sourceSystem,
        sourceCode,
        targetSystem,
        targetCode,
        active,
      });

      return res.status(200).json(list);
    } catch (error) {
      if (error instanceof CodeServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to list code mappings", error);
      return res.status(500).json({ message: "Failed to list code mappings." });
    }
  },
};
