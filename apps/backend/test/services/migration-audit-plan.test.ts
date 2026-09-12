import { describe, expect, it } from "@jest/globals";
import {
  planMigrationAudit,
  MIGRATION_AUDIT_LIMITS,
  type MigrationAuditPlanInput,
} from "../../src/services/migration-audit-plan";

const file = (
  fileName: string,
  csv: string,
): { fileName: string; content: Buffer } => ({
  fileName,
  content: Buffer.from(csv, "utf8"),
});

const VALID_OWNERS = [
  "external_id,first_name,last_name,email,phone",
  "own-1,Alex,Rivera,alex@example.test,555-0100",
  "own-2,Sam,Chen,sam@example.test,555-0101",
].join("\n");

const VALID_ANIMALS = [
  "external_id,owner_external_id,name,species,date_of_birth",
  "ani-1,own-1,Biscuit,dog,2019-04-01",
  "ani-2,own-2,Whiskers,cat,2020-06-15",
].join("\n");

const VALID_APPOINTMENTS = [
  "external_id,animal_external_id,owner_external_id,date,reason",
  "apt-1,ani-1,own-1,2026-01-10,checkup",
  "apt-2,ani-2,own-2,2026-01-11,vaccination",
].join("\n");

const VALID_ATTACHMENTS = [
  "external_id,animal_external_id,filename,sha256",
  "att-1,ani-1,biscuit-xray.pdf,abc123",
].join("\n");

const validBundle = (): MigrationAuditPlanInput => ({
  owners: file("owners.csv", VALID_OWNERS),
  animals: file("animals.csv", VALID_ANIMALS),
  appointments: file("appointments.csv", VALID_APPOINTMENTS),
  attachments: file("attachments.csv", VALID_ATTACHMENTS),
});

describe("planMigrationAudit", () => {
  it("gives exact counts and no issues for a fully consistent bundle", () => {
    const plan = planMigrationAudit(validBundle());

    expect(plan.summary.OWNERS).toMatchObject({
      status: "ASSESSED",
      totalRows: 2,
    });
    expect(plan.summary.ANIMALS).toMatchObject({
      status: "ASSESSED",
      totalRows: 2,
      orphanReferences: 0,
    });
    expect(plan.summary.APPOINTMENTS).toMatchObject({
      status: "ASSESSED",
      totalRows: 2,
      orphanReferences: 0,
    });
    expect(plan.summary.ATTACHMENTS).toMatchObject({
      status: "ASSESSED",
      totalRows: 1,
      orphanReferences: 0,
    });
    expect(plan.issues).toHaveLength(0);
  });

  it("is deterministic across repeated runs of the same bytes", () => {
    const bundle = validBundle();
    const first = planMigrationAudit(bundle);
    const second = planMigrationAudit(bundle);
    expect(second).toEqual(first);
  });

  it("marks a missing required file NOT_ASSESSED rather than passed", () => {
    const plan = planMigrationAudit({
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.OWNERS.status).toBe("NOT_ASSESSED");
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        section: "OWNERS",
        code: "missing_file",
        severity: "FATAL",
      }),
    );
  });

  it("marks a missing required column NOT_ASSESSED, not a per-row failure", () => {
    const plan = planMigrationAudit({
      owners: file("owners.csv", "external_id,first_name\nown-1,Alex"),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.OWNERS.status).toBe("NOT_ASSESSED");
    expect(plan.issues).toContainEqual(
      expect.objectContaining({ section: "OWNERS", code: "missing_column" }),
    );
  });

  it("treats an absent attachment manifest as not assessed, not an error", () => {
    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.ATTACHMENTS.status).toBe("NOT_ASSESSED");
    expect(
      plan.issues.some(
        (i) => i.section === "ATTACHMENTS" && i.severity === "FATAL",
      ),
    ).toBe(false);
  });

  it("rejects a malformed CSV without leaking its raw content", () => {
    const plan = planMigrationAudit({
      owners: file("owners.csv", '"unterminated quote,broken\nrow'),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.OWNERS.status).toBe("NOT_ASSESSED");
    const malformed = plan.issues.find((i) => i.code === "malformed_file");
    expect(malformed).toBeDefined();
    expect(malformed!.diagnostics).not.toContain("unterminated quote");
  });

  it("rejects a bundle over the row limit as NOT_ASSESSED", () => {
    const header = "external_id,first_name,last_name,email,phone";
    const rows = Array.from(
      { length: MIGRATION_AUDIT_LIMITS.maxRowsPerFile + 1 },
      (_, i) => `own-${i},A,B,a${i}@example.test,555`,
    );
    const plan = planMigrationAudit({
      owners: file("owners.csv", [header, ...rows].join("\n")),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.OWNERS.status).toBe("NOT_ASSESSED");
    expect(plan.issues).toContainEqual(
      expect.objectContaining({ code: "too_many_rows" }),
    );
  });

  it("rejects an oversized file as NOT_ASSESSED", () => {
    const big = Buffer.alloc(MIGRATION_AUDIT_LIMITS.maxFileBytes + 1, "a");
    const plan = planMigrationAudit({
      owners: { fileName: "owners.csv", content: big },
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.OWNERS.status).toBe("NOT_ASSESSED");
    expect(plan.issues).toContainEqual(
      expect.objectContaining({ code: "file_too_large" }),
    );
  });

  it("flags duplicate identifiers without merging them", () => {
    const owners = [
      "external_id,first_name,last_name,email,phone",
      "own-1,Alex,Rivera,alex@example.test,555-0100",
      "own-1,Alex,Duplicate,dup@example.test,555-9999",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", owners),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.OWNERS.duplicateIdentifiers).toBe(1);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        section: "OWNERS",
        code: "duplicate_identifier",
        rowNumber: 2,
      }),
    );
  });

  it("flags an animal referencing an owner that does not exist", () => {
    const animals = [
      "external_id,owner_external_id,name,species,date_of_birth",
      "ani-1,own-missing,Biscuit,dog,2019-04-01",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file("animals.csv", animals),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.ANIMALS.orphanReferences).toBe(1);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({ section: "ANIMALS", code: "orphan_reference" }),
    );
  });

  it("flags an appointment referencing an animal that does not exist", () => {
    const appointments = [
      "external_id,animal_external_id,owner_external_id,date,reason",
      "apt-1,ani-missing,own-1,2026-01-10,checkup",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", appointments),
    });

    expect(plan.summary.APPOINTMENTS.orphanReferences).toBe(1);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        section: "APPOINTMENTS",
        code: "orphan_reference",
      }),
    );
  });

  it("flags an appointment whose owner does not match its animal's owner as ambiguous, not merged", () => {
    const appointments = [
      "external_id,animal_external_id,owner_external_id,date,reason",
      "apt-1,ani-1,own-2,2026-01-10,checkup",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", appointments),
    });

    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        section: "APPOINTMENTS",
        code: "ambiguous_owner_reference",
        severity: "WARNING",
      }),
    );
  });

  it("flags an attachment manifest row pointing at an animal that does not exist", () => {
    const attachments = [
      "external_id,animal_external_id,filename,sha256",
      "att-1,ani-missing,file.pdf,abc",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
      attachments: file("attachments.csv", attachments),
    });

    expect(plan.summary.ATTACHMENTS.orphanReferences).toBe(1);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        section: "ATTACHMENTS",
        code: "orphan_reference",
      }),
    );
  });

  it("never fetches an external attachment URL and flags it instead", () => {
    const attachments = [
      "external_id,animal_external_id,filename,sha256",
      "att-1,ani-1,https://attacker.example/steal.pdf,abc",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
      attachments: file("attachments.csv", attachments),
    });

    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        section: "ATTACHMENTS",
        code: "external_reference_unsupported",
        severity: "ERROR",
      }),
    );
  });

  it("flags a spreadsheet-formula cell and excludes it from identifier matching", () => {
    const owners = [
      "external_id,first_name,last_name,email,phone",
      "=cmd|'/c calc'!A1,Alex,Rivera,alex@example.test,555-0100",
    ].join("\n");
    const animals = [
      "external_id,owner_external_id,name,species,date_of_birth",
      "ani-1,=cmd|'/c calc'!A1,Biscuit,dog,2019-04-01",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", owners),
      animals: file("animals.csv", animals),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    const unsafe = plan.issues.filter((i) => i.code === "unsafe_cell_content");
    expect(unsafe.length).toBeGreaterThanOrEqual(2);
    for (const issue of unsafe) {
      expect(issue.diagnostics).not.toContain("cmd|");
    }
    // The owner id is unusable as a key, so it can never silently resolve a
    // match - the row is left to the unsafe-content warning above rather than
    // also being reported as a (potentially wrong) orphan.
    expect(
      plan.issues.some(
        (i) => i.section === "ANIMALS" && i.code === "orphan_reference",
      ),
    ).toBe(false);
  });

  it("reports an unsupported column as informational, not a failure", () => {
    const owners = [
      "external_id,first_name,last_name,email,phone,legacy_notes",
      "own-1,Alex,Rivera,alex@example.test,555-0100,some note",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", owners),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.OWNERS.status).toBe("ASSESSED");
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        code: "unsupported_column",
        severity: "INFORMATION",
      }),
    );
  });

  it("marks a malformed attachment manifest NOT_ASSESSED", () => {
    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
      attachments: file("attachments.csv", "external_id,animal_external_id\n"), // missing required filename column
    });

    expect(plan.summary.ATTACHMENTS.status).toBe("NOT_ASSESSED");
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        section: "ATTACHMENTS",
        code: "missing_column",
      }),
    );
  });

  it("does not flag unsupported columns on a header-only file", () => {
    const plan = planMigrationAudit({
      owners: file(
        "owners.csv",
        "external_id,first_name,last_name,email,phone\n",
      ),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.OWNERS).toMatchObject({
      status: "ASSESSED",
      totalRows: 0,
    });
    expect(plan.issues.some((i) => i.code === "unsupported_column")).toBe(
      false,
    );
  });

  it("skips an appointment row whose animal_external_id is itself unusable", () => {
    const appointments = [
      "external_id,animal_external_id,owner_external_id,date,reason",
      "apt-1,=cmd,own-1,2026-01-10,checkup",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", appointments),
    });

    expect(
      plan.issues.some(
        (i) => i.section === "APPOINTMENTS" && i.code === "orphan_reference",
      ),
    ).toBe(false);
    expect(
      plan.issues.some(
        (i) => i.section === "APPOINTMENTS" && i.code === "unsafe_cell_content",
      ),
    ).toBe(true);
  });

  it("does not flag ambiguity when an appointment's owner_external_id is itself unusable", () => {
    const appointments = [
      "external_id,animal_external_id,owner_external_id,date,reason",
      "apt-1,ani-1,=cmd,2026-01-10,checkup",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", appointments),
    });

    expect(
      plan.issues.some(
        (i) =>
          i.section === "APPOINTMENTS" &&
          i.code === "ambiguous_owner_reference",
      ),
    ).toBe(false);
  });

  it("skips an attachment row whose animal_external_id is itself unusable, and tolerates a missing filename cell", () => {
    const attachments = [
      "external_id,animal_external_id,filename",
      "att-1,=cmd",
    ].join("\n");

    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
      attachments: file("attachments.csv", attachments),
    });

    expect(
      plan.issues.some(
        (i) => i.section === "ATTACHMENTS" && i.code === "orphan_reference",
      ),
    ).toBe(false);
  });

  it("does not cross-reference against a NOT_ASSESSED section", () => {
    const plan = planMigrationAudit({
      owners: file("owners.csv", "external_id,first_name\nown-1,Alex"), // missing required email -> NOT_ASSESSED
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.OWNERS.status).toBe("NOT_ASSESSED");
    // Every animal references an owner id that cannot be checked - must not be
    // reported as an orphan, because owners.csv itself was never assessed.
    expect(
      plan.issues.some(
        (i) => i.section === "ANIMALS" && i.code === "orphan_reference",
      ),
    ).toBe(false);
  });

  it("does not cross-reference appointments when animals itself is NOT_ASSESSED", () => {
    const plan = planMigrationAudit({
      owners: file("owners.csv", VALID_OWNERS),
      animals: file(
        "animals.csv",
        "external_id,owner_external_id\nani-1,own-1",
      ), // missing required name -> NOT_ASSESSED
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.ANIMALS.status).toBe("NOT_ASSESSED");
    expect(
      plan.issues.some(
        (i) => i.section === "APPOINTMENTS" && i.code === "orphan_reference",
      ),
    ).toBe(false);
  });

  it("treats a completely empty file the same as a missing required column", () => {
    const plan = planMigrationAudit({
      owners: file("owners.csv", ""),
      animals: file("animals.csv", VALID_ANIMALS),
      appointments: file("appointments.csv", VALID_APPOINTMENTS),
    });

    expect(plan.summary.OWNERS.status).toBe("NOT_ASSESSED");
    expect(plan.issues).toContainEqual(
      expect.objectContaining({ section: "OWNERS", code: "missing_column" }),
    );
  });
});
