import type { ContactSource } from "src/models/contect-us";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { SuperadminContactService } from "src/services/superadmin-contact.service";

interface BackfillOptions {
  since?: Date;
  until?: Date;
  batchSize?: number;
  apply?: boolean;
}

interface BackfillResult {
  total: number;
  forwarded: number;
  skipped: number;
  failed: number;
}

export const parseDate = (value: string, label: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} must be a valid ISO timestamp.`);
  }
  return date;
};

export const parseArgs = (argv: string[]): BackfillOptions => {
  const options: BackfillOptions = { apply: false };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--since") {
      options.since = parseDate(argv[++i], "--since");
    } else if (arg === "--until") {
      options.until = parseDate(argv[++i], "--until");
    } else if (arg === "--batch-size") {
      const size = Number.parseInt(argv[++i], 10);
      if (!Number.isInteger(size) || size <= 0) {
        throw new TypeError("--batch-size must be a positive integer.");
      }
      options.batchSize = size;
    } else if (arg.startsWith("--")) {
      throw new TypeError(`Unknown argument: ${arg}`);
    }
    i++;
  }
  return options;
};

const report = (result: BackfillResult, apply: boolean) => {
  console.log(
    `Backfill complete: ${result.total} total, ${result.forwarded} forwarded, ${result.skipped} skipped, ${result.failed} failed`,
  );
  if (!apply) {
    console.log("dry run - pass --apply to write");
  }
};

export const planBackfill = async (
  options: BackfillOptions,
): Promise<BackfillResult> => {
  // Dry run: just count what would be processed
  const where = {
    source: { in: ["PMS_WEB", "MARKETING_SITE"] as ContactSource[] },
    createdAt: undefined as { gt?: Date; lte?: Date } | undefined,
  };
  if (options.since)
    where.createdAt = { ...where.createdAt, gt: options.since };
  if (options.until)
    where.createdAt = { ...where.createdAt, lte: options.until };
  if (!where.createdAt?.gt && !where.createdAt?.lte) {
    delete where.createdAt;
  }

  const total = await prisma.contactRequest.count({ where });
  console.log(`Would process ${total} contact request(s)`);
  return { total, forwarded: 0, skipped: 0, failed: 0 };
};

export const runBackfill = async (
  options: BackfillOptions,
): Promise<BackfillResult> => {
  if (!options.apply) {
    return planBackfill(options);
  }

  // Validate required environment variables
  const url = process.env.SUPERADMIN_CONTACT_INTAKE_URL;
  const key = process.env.SUPERADMIN_CONTACT_INTAKE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPERADMIN_CONTACT_INTAKE_URL and SUPERADMIN_CONTACT_INTAKE_KEY must be configured",
    );
  }

  console.log("Starting contact submission backfill...");
  const result =
    await SuperadminContactService.backfillContactSubmissions(options);
  report(result, true);
  return result;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  try {
    await runBackfill(options);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Contact backfill failed.",
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

if (
  process.argv[1] &&
  process.argv[1].endsWith("backfill-contact-submissions.ts")
) {
  main();
}

export type { BackfillOptions, BackfillResult };
