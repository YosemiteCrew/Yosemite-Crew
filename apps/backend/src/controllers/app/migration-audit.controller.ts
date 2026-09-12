import type { Request, Response } from "express";
import { z } from "zod";
import type {
  OperationOutcome,
  OperationOutcomeIssue,
} from "@yosemite-crew/fhir";
import {
  resolveVerifiedUserId,
  resolveVerifiedOrganisationId,
} from "src/utils/request";
import {
  createMigrationAuditRun,
  getMigrationAuditRun,
  mintMigrationAuditUploadUrl,
  MigrationAuditServiceError,
} from "src/services/migration-audit.service";
import logger from "src/utils/logger";

const CreateRunBodySchema = z
  .object({
    sourceKeys: z
      .object({
        owners: z.string().min(1),
        animals: z.string().min(1),
        appointments: z.string().min(1),
        attachments: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

const issueExpression = (
  sourceFile: string,
  rowNumber: number | null,
): string => {
  if (!rowNumber) return sourceFile;
  return `${sourceFile}[row ${rowNumber}]`;
};

const handleError = (error: unknown, res: Response, context: string) => {
  if (error instanceof MigrationAuditServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error(context, { error });
  return res.status(500).json({ message: "Internal Server Error" });
};

export const MigrationAuditController = {
  getUploadUrl: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveVerifiedOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }

      const result = await mintMigrationAuditUploadUrl(organisationId);
      return res.status(200).json(result);
    } catch (error) {
      return handleError(
        error,
        res,
        "Error minting migration-audit upload URL",
      );
    }
  },

  createRun: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveVerifiedOrganisationId(req);
      const createdByUserId = resolveVerifiedUserId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }
      if (!createdByUserId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      const parsed = CreateRunBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Invalid migration audit request." });
      }

      const run = await createMigrationAuditRun({
        organisationId,
        createdByUserId,
        sourceKeys: parsed.data.sourceKeys,
      });

      return res.status(201).json({ id: run.id, status: run.status });
    } catch (error) {
      return handleError(error, res, "Error creating migration audit run");
    }
  },

  getRun: async (req: Request<{ auditRunId: string }>, res: Response) => {
    try {
      const organisationId = resolveVerifiedOrganisationId(req);
      if (!organisationId) {
        return res.status(400).json({ message: "organisationId is required." });
      }

      const { auditRunId } = req.params;
      const run = await getMigrationAuditRun(organisationId, auditRunId);

      const outcome: OperationOutcome = {
        resourceType: "OperationOutcome",
        issue: run.issues.map((issue): OperationOutcomeIssue => ({
          severity: issue.severity.toLowerCase(),
          code: issue.code,
          diagnostics: issue.diagnostics,
          expression: [issueExpression(issue.sourceFile, issue.rowNumber)],
        })),
      };

      return res.status(200).json({
        id: run.id,
        status: run.status,
        summary: run.summary,
        errorMessage: run.errorMessage,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        outcome,
      });
    } catch (error) {
      return handleError(error, res, "Error fetching migration audit run");
    }
  },
};
