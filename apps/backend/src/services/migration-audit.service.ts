import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  generatePresignedUrl,
  readObjectBounded,
  CSV_MIME_TYPES,
} from "src/middlewares/upload";
import {
  MigrationAuditQueue,
  MigrationAuditJobs,
} from "src/queues/migration-audit.queue";
import logger from "src/utils/logger";
import {
  planMigrationAudit,
  MIGRATION_AUDIT_LIMITS,
  type MigrationAuditFileInput,
  type MigrationAuditSectionName,
} from "src/services/migration-audit-plan";

export class MigrationAuditServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "MigrationAuditServiceError";
  }
}

export type MigrationAuditFileRole =
  "owners" | "animals" | "appointments" | "attachments";

const REQUIRED_ROLES: MigrationAuditFileRole[] = [
  "owners",
  "animals",
  "appointments",
];

export async function mintMigrationAuditUploadUrl(
  organisationId: string,
): Promise<{ url: string; key: string }> {
  return generatePresignedUrl(
    "text/csv",
    "org",
    organisationId,
    CSV_MIME_TYPES,
  );
}

export interface CreateMigrationAuditRunInput {
  organisationId: string;
  createdByUserId: string;
  sourceKeys: Partial<Record<MigrationAuditFileRole, string>>;
}

/**
 * S3 keys are minted by `mintMigrationAuditUploadUrl` under `orgs/<organisationId>/...`,
 * so a key for a different organisation can never be accepted here - it just
 * wouldn't have been mintable for this caller in the first place. Checked
 * anyway, defensively, in case a caller supplies an arbitrary string.
 */
function assertKeyBelongsToOrganisation(
  key: string,
  organisationId: string,
): void {
  if (!key.startsWith(`orgs/${organisationId}/`)) {
    throw new MigrationAuditServiceError(
      "Source file key does not belong to this organisation.",
      400,
    );
  }
}

export async function createMigrationAuditRun(
  input: CreateMigrationAuditRunInput,
) {
  const missing = REQUIRED_ROLES.filter((role) => !input.sourceKeys[role]);
  if (missing.length > 0) {
    throw new MigrationAuditServiceError(
      `Missing required file(s): ${missing.join(", ")}.`,
      400,
    );
  }

  for (const [, key] of Object.entries(input.sourceKeys)) {
    if (key) assertKeyBelongsToOrganisation(key, input.organisationId);
  }

  // A stable ordering makes the hash a function of content, not of upload order.
  const orderedRoles: MigrationAuditFileRole[] = [
    "owners",
    "animals",
    "appointments",
    "attachments",
  ];
  const hash = createHash("sha256");
  for (const role of orderedRoles) {
    const key = input.sourceKeys[role];
    hash.update(role);
    hash.update(key ?? "");
  }

  const run = await prisma.migrationAuditRun.create({
    data: {
      organisationId: input.organisationId,
      createdByUserId: input.createdByUserId,
      status: "PENDING",
      inputHash: hash.digest("hex"),
      sourceFiles: input.sourceKeys,
    },
  });

  await MigrationAuditQueue.add(MigrationAuditJobs.RUN, { auditRunId: run.id });

  return run;
}

export async function getMigrationAuditRun(
  organisationId: string,
  auditRunId: string,
) {
  const run = await prisma.migrationAuditRun.findFirst({
    where: { id: auditRunId, organisationId },
    include: {
      issues: { orderBy: [{ section: "asc" }, { rowNumber: "asc" }] },
    },
  });

  if (!run) {
    throw new MigrationAuditServiceError("Migration audit run not found.", 404);
  }

  return run;
}

const ROLE_TO_SECTION: Record<
  MigrationAuditFileRole,
  MigrationAuditSectionName
> = {
  owners: "OWNERS",
  animals: "ANIMALS",
  appointments: "APPOINTMENTS",
  attachments: "ATTACHMENTS",
};

/**
 * Called by the BullMQ worker only. Reads the source CSVs from S3 (each
 * bounded to MIGRATION_AUDIT_LIMITS.maxFileBytes before the body is even
 * fetched), runs the pure planner, and persists the result. Idempotent: a
 * retried job re-reads the same immutable S3 objects and overwrites the same
 * row with the same findings.
 */
export async function runMigrationAudit(auditRunId: string): Promise<void> {
  const run = await prisma.migrationAuditRun.findUnique({
    where: { id: auditRunId },
  });
  if (!run) {
    logger.error(`migration-audit: run ${auditRunId} not found`);
    return;
  }

  await prisma.migrationAuditRun.update({
    where: { id: auditRunId },
    data: { status: "RUNNING" },
  });

  try {
    const sourceFiles = run.sourceFiles as Partial<
      Record<MigrationAuditFileRole, string>
    >;
    const planInput: Partial<
      Record<MigrationAuditSectionName, MigrationAuditFileInput>
    > = {};

    for (const role of Object.keys(sourceFiles) as MigrationAuditFileRole[]) {
      const key = sourceFiles[role];
      if (!key) continue;
      const content = await readObjectBounded(
        key,
        MIGRATION_AUDIT_LIMITS.maxFileBytes,
      );
      planInput[ROLE_TO_SECTION[role]] = { fileName: `${role}.csv`, content };
    }

    const plan = planMigrationAudit({
      owners: planInput.OWNERS,
      animals: planInput.ANIMALS,
      appointments: planInput.APPOINTMENTS,
      attachments: planInput.ATTACHMENTS,
    });

    await prisma.$transaction([
      prisma.migrationAuditIssue.deleteMany({ where: { auditRunId } }),
      prisma.migrationAuditIssue.createMany({
        data: plan.issues.map((issue) => ({
          auditRunId,
          section: issue.section,
          severity: issue.severity,
          code: issue.code,
          diagnostics: issue.diagnostics,
          sourceFile: issue.sourceFile,
          rowNumber: issue.rowNumber,
        })),
      }),
      prisma.migrationAuditRun.update({
        where: { id: auditRunId },
        data: {
          status: "COMPLETED",
          summary: plan.summary as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    logger.error("migration-audit: run failed", { auditRunId, error });
    await prisma.migrationAuditRun.update({
      where: { id: auditRunId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });
  }
}
