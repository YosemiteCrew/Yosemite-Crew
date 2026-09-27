import fs from "node:fs";
import path from "node:path";

// Consent templates saved with no "Signed by" choice keep the "No signature
// required" the form builder showed for them. What the SQL does to real rows,
// and that it is idempotent, is checked against Postgres in the migration CI
// stage; this pins the statement's shape next to the code that reads it.
const migration = fs
  .readFileSync(
    path.resolve(
      __dirname,
      "../../../../packages/database/prisma/migrations/20260927150000_consent_templates_without_signer/migration.sql",
    ),
    "utf8",
  )
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("consent templates without a signer", () => {
  it("only updates templates", () => {
    expect(migration.match(/\b(UPDATE|INSERT|DELETE|ALTER|DROP)\b/g)).toEqual([
      "UPDATE",
    ]);
    expect(migration).toMatch(/^UPDATE "Template"$/m);
  });

  it("names no signature, with the marker the undo reads", () => {
    expect(migration).toContain(
      `'{"requiredSigner": "NONE", "requiredSignerBackfilled": true}'::jsonb`,
    );
  });

  it("touches consents, including those saved as forms", () => {
    expect(migration).toContain("kind = 'CONSENT'");
    expect(migration).toContain(
      "(kind = 'FORM' AND rules ->> 'category' = 'Consent form')",
    );
  });

  it("leaves a consent that names a signer alone", () => {
    expect(migration).toMatch(
      /AND COALESCE\(btrim\(\s*CASE WHEN jsonb_typeof\(rules -> 'requiredSigner'\) = 'string'\s*THEN rules ->> 'requiredSigner'\s*END\s*\), ''\) = '';/,
    );
  });
});
