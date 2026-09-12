// Pure, deterministic planner for the migration-audit vertical slice (#3056).
//
// Takes raw CSV bytes for a candidate bundle (owners, animals, appointments,
// optional attachment manifest) and returns findings plus per-section
// summaries. No I/O, no side effects, no clock reads inside the comparison
// logic - the same bytes always produce the same plan, which is what the
// "re-running the same input gives the same findings" acceptance criterion
// requires. Persistence and S3 reads live in migration-audit.service.ts.
import { parse } from "csv-parse/sync";

export type MigrationAuditSectionName =
  "OWNERS" | "ANIMALS" | "APPOINTMENTS" | "ATTACHMENTS";

export type MigrationAuditSeverityName =
  "FATAL" | "ERROR" | "WARNING" | "INFORMATION";

/**
 * Bounded on purpose: this is a preview/audit tool, not a bulk-import
 * pipeline. A bundle over either limit is refused outright (NOT_ASSESSED)
 * rather than partially scanned, so a truncated read can never be reported as
 * a complete one.
 */
export const MIGRATION_AUDIT_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxRowsPerFile: 5000,
} as const;

/**
 * The exact supported columns per file, published here because the issue
 * requires publishing them. Columns outside this list are ignored for
 * validation but reported as INFORMATION so a caller knows they were not
 * assessed - never silently dropped.
 */
export const MIGRATION_AUDIT_COLUMNS = {
  OWNERS: ["external_id", "first_name", "last_name", "email", "phone"],
  ANIMALS: [
    "external_id",
    "owner_external_id",
    "name",
    "species",
    "date_of_birth",
  ],
  APPOINTMENTS: [
    "external_id",
    "animal_external_id",
    "owner_external_id",
    "date",
    "reason",
  ],
  ATTACHMENTS: ["external_id", "animal_external_id", "filename", "sha256"],
} as const satisfies Record<MigrationAuditSectionName, readonly string[]>;

const REQUIRED_COLUMNS: Record<MigrationAuditSectionName, readonly string[]> = {
  OWNERS: ["external_id", "first_name", "email"],
  ANIMALS: ["external_id", "owner_external_id", "name"],
  APPOINTMENTS: [
    "external_id",
    "animal_external_id",
    "owner_external_id",
    "date",
  ],
  ATTACHMENTS: ["external_id", "animal_external_id", "filename"],
};

/**
 * OWASP CSV/formula injection: a cell that opens with one of these characters
 * is interpreted as a formula by a spreadsheet application, not as data, if
 * the value is later re-exported and opened. Matched on the raw cell alone -
 * the flagged value is never echoed into a diagnostic or stored anywhere.
 */
const FORMULA_INJECTION_PREFIX = /^[=+\-@]/;

const URL_LIKE = /^[a-z][a-z0-9+.-]*:\/\//i;

export interface MigrationAuditFileInput {
  /** Logical file name for reporting only - never used to derive a path or key. */
  fileName: string;
  content: Buffer;
}

export interface MigrationAuditPlanInput {
  owners?: MigrationAuditFileInput;
  animals?: MigrationAuditFileInput;
  appointments?: MigrationAuditFileInput;
  attachments?: MigrationAuditFileInput;
}

export interface MigrationAuditIssueDraft {
  section: MigrationAuditSectionName;
  severity: MigrationAuditSeverityName;
  code: string;
  diagnostics: string;
  sourceFile: string;
  rowNumber?: number;
}

export interface MigrationAuditSectionSummary {
  status: "ASSESSED" | "NOT_ASSESSED";
  /** Why NOT_ASSESSED, when applicable - absent otherwise. */
  notAssessedReason?: string;
  totalRows: number;
  duplicateIdentifiers: number;
  orphanReferences: number;
}

export interface MigrationAuditPlan {
  issues: MigrationAuditIssueDraft[];
  summary: Record<MigrationAuditSectionName, MigrationAuditSectionSummary>;
}

type ParsedRow = Record<string, string>;

interface ParseOutcome {
  rows: ParsedRow[] | null;
  headerColumns: string[];
  fatalIssue: MigrationAuditIssueDraft | null;
}

const emptySummary = (
  status: MigrationAuditSectionSummary["status"],
  reason?: string,
): MigrationAuditSectionSummary => ({
  status,
  notAssessedReason: reason,
  totalRows: 0,
  duplicateIdentifiers: 0,
  orphanReferences: 0,
});

function parseSectionFile(
  section: MigrationAuditSectionName,
  file: MigrationAuditFileInput,
): ParseOutcome {
  if (file.content.byteLength > MIGRATION_AUDIT_LIMITS.maxFileBytes) {
    return {
      rows: null,
      headerColumns: [],
      fatalIssue: {
        section,
        severity: "FATAL",
        code: "file_too_large",
        diagnostics: `${file.fileName} exceeds the ${MIGRATION_AUDIT_LIMITS.maxFileBytes} byte limit and was not read.`,
        sourceFile: file.fileName,
      },
    };
  }

  let rows: ParsedRow[];
  let headerColumns: string[];
  try {
    // Header columns are read from a raw (non-`columns`) parse first, because
    // csv-parse's `columns: true` infers the header from the first record and
    // gives back no column list at all when the file has zero data rows - a
    // header-only file would otherwise look identical to a file missing every
    // required column.
    const rawRows = parse(file.content, {
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
    headerColumns = rawRows[0] ?? [];
    rows = parse(file.content, {
      columns: headerColumns,
      from_line: 2,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch {
    // Deliberately no CsvError detail in the message: it can quote the
    // offending raw bytes, which may themselves be untrusted cell content.
    return {
      rows: null,
      headerColumns: [],
      fatalIssue: {
        section,
        severity: "FATAL",
        code: "malformed_file",
        diagnostics: `${file.fileName} could not be parsed as CSV.`,
        sourceFile: file.fileName,
      },
    };
  }

  if (rows.length > MIGRATION_AUDIT_LIMITS.maxRowsPerFile) {
    return {
      rows: null,
      headerColumns,
      fatalIssue: {
        section,
        severity: "FATAL",
        code: "too_many_rows",
        diagnostics: `${file.fileName} has more than ${MIGRATION_AUDIT_LIMITS.maxRowsPerFile} rows and was not assessed.`,
        sourceFile: file.fileName,
      },
    };
  }

  const requiredColumns = REQUIRED_COLUMNS[section];
  const presentColumns = new Set(headerColumns);
  const missingColumns = requiredColumns.filter(
    (column) => !presentColumns.has(column),
  );

  if (missingColumns.length > 0) {
    return {
      rows: null,
      headerColumns,
      fatalIssue: {
        section,
        severity: "FATAL",
        code: "missing_column",
        diagnostics: `${file.fileName} is missing required column(s): ${missingColumns.join(", ")}.`,
        sourceFile: file.fileName,
      },
    };
  }

  return { rows, headerColumns, fatalIssue: null };
}

/**
 * A row's identifier is unusable as a join key once it is empty or itself
 * looks like a formula - a poisoned or missing identifier must not silently
 * link two records together, so anything referencing it reads as an orphan
 * rather than a match.
 */
function usableIdentifier(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !FORMULA_INJECTION_PREFIX.test(value)
  );
}

function scanUnsafeCells(
  section: MigrationAuditSectionName,
  file: MigrationAuditFileInput,
  rows: ParsedRow[],
  columns: readonly string[],
): MigrationAuditIssueDraft[] {
  const issues: MigrationAuditIssueDraft[] = [];
  rows.forEach((row, index) => {
    for (const column of columns) {
      const value = row[column];
      if (typeof value === "string" && FORMULA_INJECTION_PREFIX.test(value)) {
        issues.push({
          section,
          severity: "WARNING",
          code: "unsafe_cell_content",
          diagnostics: `${file.fileName} row ${index + 1}, column "${column}" opens with a spreadsheet-formula character and was excluded from matching.`,
          sourceFile: file.fileName,
          rowNumber: index + 1,
        });
      }
    }
  });
  return issues;
}

function scanUnknownColumns(
  section: MigrationAuditSectionName,
  file: MigrationAuditFileInput,
  headerColumns: string[],
): MigrationAuditIssueDraft[] {
  const supported = new Set<string>(MIGRATION_AUDIT_COLUMNS[section]);
  const unknown = headerColumns.filter((c) => !supported.has(c));
  if (unknown.length === 0) return [];
  return [
    {
      section,
      severity: "INFORMATION",
      code: "unsupported_column",
      diagnostics: `${file.fileName} has column(s) outside the supported set and they were not assessed: ${unknown.join(", ")}.`,
      sourceFile: file.fileName,
    },
  ];
}

function scanDuplicates(
  section: MigrationAuditSectionName,
  file: MigrationAuditFileInput,
  rows: ParsedRow[],
): { issues: MigrationAuditIssueDraft[]; duplicateCount: number } {
  const seenAtRow = new Map<string, number>();
  const issues: MigrationAuditIssueDraft[] = [];
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const id = row.external_id;
    if (!usableIdentifier(id)) return;
    const firstRow = seenAtRow.get(id);
    if (firstRow === undefined) {
      seenAtRow.set(id, index + 1);
      return;
    }
    duplicateCount += 1;
    issues.push({
      section,
      severity: "WARNING",
      code: "duplicate_identifier",
      diagnostics: `${file.fileName} row ${index + 1} repeats external_id already seen at row ${firstRow}. Not merged automatically - review required.`,
      sourceFile: file.fileName,
      rowNumber: index + 1,
    });
  });

  return { issues, duplicateCount };
}

interface SectionResult {
  summary: MigrationAuditSectionSummary;
  issues: MigrationAuditIssueDraft[];
  rows: ParsedRow[] | null;
}

/**
 * Handles one section's file end to end: absence, parse failure, or a
 * successful parse followed by the per-row scans. `required` only changes
 * what an absent file means - a missing owners/animals/appointments file is a
 * FATAL "missing_file"; a missing attachment manifest is an expected,
 * informational "not provided".
 */
function processSection(
  section: MigrationAuditSectionName,
  file: MigrationAuditFileInput | undefined,
  required: boolean,
): SectionResult {
  if (!file) {
    return required
      ? {
          summary: emptySummary("NOT_ASSESSED", "file_not_provided"),
          rows: null,
          issues: [
            {
              section,
              severity: "FATAL",
              code: "missing_file",
              diagnostics: `${section.toLowerCase()}.csv was not provided.`,
              sourceFile: `${section.toLowerCase()}.csv`,
            },
          ],
        }
      : {
          summary: emptySummary("NOT_ASSESSED", "file_not_provided"),
          rows: null,
          issues: [
            {
              section,
              severity: "INFORMATION",
              code: "attachment_manifest_not_provided",
              diagnostics:
                "No attachment manifest was provided; attachments were not assessed.",
              sourceFile: "attachments.csv",
            },
          ],
        };
  }

  const outcome = parseSectionFile(section, file);
  if (!outcome.rows) {
    return {
      summary: emptySummary("NOT_ASSESSED", outcome.fatalIssue!.code),
      rows: null,
      issues: [outcome.fatalIssue!],
    };
  }

  const issues = [
    ...scanUnknownColumns(section, file, outcome.headerColumns),
    ...scanUnsafeCells(
      section,
      file,
      outcome.rows,
      MIGRATION_AUDIT_COLUMNS[section],
    ),
  ];
  const { issues: dupIssues, duplicateCount } = scanDuplicates(
    section,
    file,
    outcome.rows,
  );
  issues.push(...dupIssues);

  return {
    summary: {
      status: "ASSESSED",
      totalRows: outcome.rows.length,
      duplicateIdentifiers: duplicateCount,
      orphanReferences: 0,
    },
    rows: outcome.rows,
    issues,
  };
}

export function planMigrationAudit(
  input: MigrationAuditPlanInput,
): MigrationAuditPlan {
  const issues: MigrationAuditIssueDraft[] = [];
  const summary = {} as Record<
    MigrationAuditSectionName,
    MigrationAuditSectionSummary
  >;

  const parsedRowsBySection: Partial<
    Record<MigrationAuditSectionName, ParsedRow[]>
  > = {};
  const fileBySection: Partial<
    Record<MigrationAuditSectionName, MigrationAuditFileInput>
  > = {};

  const SECTION_INPUTS: [
    MigrationAuditSectionName,
    MigrationAuditFileInput | undefined,
    boolean,
  ][] = [
    ["OWNERS", input.owners, true],
    ["ANIMALS", input.animals, true],
    ["APPOINTMENTS", input.appointments, true],
    ["ATTACHMENTS", input.attachments, false],
  ];

  for (const [section, file, required] of SECTION_INPUTS) {
    if (file) fileBySection[section] = file;
    const result = processSection(section, file, required);
    summary[section] = result.summary;
    issues.push(...result.issues);
    if (result.rows) parsedRowsBySection[section] = result.rows;
  }

  // Cross-reference checks. Only run against sections that were themselves
  // ASSESSED - referencing a NOT_ASSESSED section would report every row in
  // the dependent section as orphaned, which is a fact about the missing
  // file, not about the rows that reference it.
  const ownerIds = new Set(
    (parsedRowsBySection.OWNERS ?? [])
      .map((r) => r.external_id)
      .filter(usableIdentifier),
  );
  const animalOwner = new Map<string, string>();
  (parsedRowsBySection.ANIMALS ?? []).forEach((row) => {
    if (
      usableIdentifier(row.external_id) &&
      usableIdentifier(row.owner_external_id)
    ) {
      animalOwner.set(row.external_id, row.owner_external_id);
    }
  });
  const animalIds = new Set(animalOwner.keys());

  let animalOrphans = 0;
  if (
    summary.ANIMALS.status === "ASSESSED" &&
    summary.OWNERS.status === "ASSESSED"
  ) {
    parsedRowsBySection.ANIMALS!.forEach((row, index) => {
      if (!usableIdentifier(row.owner_external_id)) return; // already flagged unsafe/missing
      if (!ownerIds.has(row.owner_external_id)) {
        animalOrphans += 1;
        issues.push({
          section: "ANIMALS",
          severity: "ERROR",
          code: "orphan_reference",
          diagnostics: `${fileBySection.ANIMALS!.fileName} row ${index + 1} references owner_external_id not present in owners.csv.`,
          sourceFile: fileBySection.ANIMALS!.fileName,
          rowNumber: index + 1,
        });
      }
    });
    summary.ANIMALS.orphanReferences = animalOrphans;
  }

  let appointmentOrphans = 0;
  let appointmentAmbiguous = 0;
  if (
    summary.APPOINTMENTS.status === "ASSESSED" &&
    summary.ANIMALS.status === "ASSESSED"
  ) {
    parsedRowsBySection.APPOINTMENTS!.forEach((row, index) => {
      const file = fileBySection.APPOINTMENTS!;
      if (!usableIdentifier(row.animal_external_id)) return;

      if (!animalIds.has(row.animal_external_id)) {
        appointmentOrphans += 1;
        issues.push({
          section: "APPOINTMENTS",
          severity: "ERROR",
          code: "orphan_reference",
          diagnostics: `${file.fileName} row ${index + 1} references animal_external_id not present in animals.csv.`,
          sourceFile: file.fileName,
          rowNumber: index + 1,
        });
        return;
      }

      if (!usableIdentifier(row.owner_external_id)) return;
      const resolvedOwner = animalOwner.get(row.animal_external_id);
      if (resolvedOwner && resolvedOwner !== row.owner_external_id) {
        appointmentAmbiguous += 1;
        issues.push({
          section: "APPOINTMENTS",
          severity: "WARNING",
          code: "ambiguous_owner_reference",
          diagnostics: `${file.fileName} row ${index + 1}'s owner_external_id does not match the referenced animal's owner in animals.csv. Review required before mapping.`,
          sourceFile: file.fileName,
          rowNumber: index + 1,
        });
      }
    });
    summary.APPOINTMENTS.orphanReferences =
      appointmentOrphans + appointmentAmbiguous;
  }

  if (
    summary.ATTACHMENTS?.status === "ASSESSED" &&
    summary.ANIMALS.status === "ASSESSED"
  ) {
    const file = fileBySection.ATTACHMENTS!;
    let attachmentOrphans = 0;
    parsedRowsBySection.ATTACHMENTS!.forEach((row, index) => {
      if (URL_LIKE.test(row.filename ?? "")) {
        issues.push({
          section: "ATTACHMENTS",
          severity: "ERROR",
          code: "external_reference_unsupported",
          diagnostics: `${file.fileName} row ${index + 1}'s filename is a URL. External attachment URLs are never fetched by this audit.`,
          sourceFile: file.fileName,
          rowNumber: index + 1,
        });
        return;
      }
      if (!usableIdentifier(row.animal_external_id)) return;
      if (!animalIds.has(row.animal_external_id)) {
        attachmentOrphans += 1;
        issues.push({
          section: "ATTACHMENTS",
          severity: "ERROR",
          code: "orphan_reference",
          diagnostics: `${file.fileName} row ${index + 1} references animal_external_id not present in animals.csv.`,
          sourceFile: file.fileName,
          rowNumber: index + 1,
        });
      }
    });
    summary.ATTACHMENTS.orphanReferences = attachmentOrphans;
  }

  return { issues, summary };
}
