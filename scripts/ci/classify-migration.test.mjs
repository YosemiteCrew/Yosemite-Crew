// Tests for the destructive-migration gate.
//
// What is pinned here is the CLASSIFICATION, because that is what decides
// whether a migration reds a build. Each case below is either a shape this
// repository's migrations actually take, or a way an earlier draft of this
// gate got the answer wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyMigrationSql,
  stripSqlComments,
  splitStatements,
  readDeclaration,
  reviewMigration,
  migrationName,
  MIN_DECLARATION_LENGTH,
} from './classify-migration.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const kinds = (sql) => classifyMigrationSql(sql).map((h) => h.kind);

test('an additive migration has no hazards', () => {
  assert.deepEqual(
    kinds('-- AlterTable\nALTER TABLE "Invoice" ADD COLUMN "note" TEXT;'),
    [],
  );
});

test('a dropped column is a hazard', () => {
  assert.deepEqual(
    kinds('ALTER TABLE "Invoice" DROP COLUMN "note";'),
    ['drops a column'],
  );
});

test('a renamed column is a hazard - the #2599 shape', () => {
  // #2599 renamed three columns. It was safe because all three tables held zero
  // rows, which is a fact about that PR, not about renames.
  assert.deepEqual(
    kinds('ALTER TABLE "Invoice" RENAME COLUMN "old" TO "new";'),
    ['renames a column'],
  );
});

// The false positive that would have made this gate useless. Prisma writes this
// header on precisely the migrations worth catching, and
// 20260615100345_parent_patient_migration in this repo carries a real one.
test('Prisma\'s warning header is not mistaken for the statement', () => {
  const sql = `/*
  Warnings:

  - You are about to drop the column \`companion\` on the \`AdverseEventReport\` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AdverseEventReport" ADD COLUMN "patient" JSONB;
`;
  assert.deepEqual(kinds(sql), []);
});

test('the real 20260615100345 migration is classified from its statements, not its prose', () => {
  const path = join(
    repoRoot,
    'packages/database/prisma/migrations/20260615100345_parent_patient_migration/migration.sql',
  );
  const sql = readFileSync(path, 'utf8');

  // It genuinely does drop a column and set another NOT NULL further down, so
  // the answer must be non-empty - but it must come from the DDL. Stripping the
  // header alone leaves those statements standing.
  const found = kinds(sql);
  assert.ok(found.includes('drops a column'), `expected a real drop, got ${JSON.stringify(found)}`);

  // And the prose alone must not be enough: with every statement removed, only
  // the warning block remains and nothing should fire.
  const proseOnly = sql.slice(0, sql.indexOf('*/') + 2);
  assert.deepEqual(kinds(proseOnly), []);
});

// Migrations here run DDL out of a string inside a DO block, so blanking
// literal bodies - the easy way to stop `--` in a string reading as a comment -
// would hide the statements most worth catching.
test('DDL executed from inside a DO block is still seen', () => {
  const sql = `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE column_name = 'companion') THEN
    EXECUTE 'ALTER TABLE "AdverseEventReport" DROP COLUMN "companion"';
  END IF;
END $$;`;
  assert.deepEqual(kinds(sql), ['drops a column']);
});

test('a table rename inside a DO block is reported', () => {
  const sql = `DO $$
BEGIN
  EXECUTE 'ALTER TABLE "Old" RENAME TO "New"';
END $$;`;
  assert.deepEqual(kinds(sql), ['renames a table']);
});

test('a DO block is split at its semicolons, so unrelated clauses do not combine', () => {
  // Held whole, this block satisfies ALTER TABLE and RENAME TO at once and
  // reports a table rename that is not there. Only the index is renamed.
  const sql = `DO $$
BEGIN
  EXECUTE 'ALTER TABLE "Invoice" ADD COLUMN "note" TEXT';
  EXECUTE 'ALTER INDEX "Invoice_id_idx" RENAME TO "Invoice_pkey_idx"';
END $$;`;
  assert.deepEqual(kinds(sql), []);
});

// ALTER INDEX ... RENAME TO appears 26 times in this repo's history. Index
// names appear in no application query, so flagging them would drown the
// signal - which is why the table rule checks for ALTER TABLE.
test('renaming an index is not a hazard, renaming a table is', () => {
  assert.deepEqual(kinds('ALTER INDEX "Invoice_id_idx" RENAME TO "Invoice_pkey_idx";'), []);
  assert.deepEqual(kinds('ALTER TABLE "Invoice" RENAME TO "Bill";'), ['renames a table']);
});

test('renaming an enum type is a hazard', () => {
  // Prisma casts enum values to the type by name, so a deployed client keeps
  // naming the old one.
  assert.deepEqual(kinds('ALTER TYPE "CodeSystem" RENAME TO "CodeSystemV2";'), ['renames an enum type']);
});

test('renaming a constraint is not mistaken for renaming a table', () => {
  assert.deepEqual(kinds('ALTER TABLE "Invoice" RENAME CONSTRAINT "a" TO "b";'), []);
});

test('a required column with no default is caught beside one that has a default', () => {
  // Asking whether DEFAULT appears anywhere in the statement clears the first
  // clause on the strength of the second.
  const sql = 'ALTER TABLE "Invoice" ADD COLUMN "a" TEXT NOT NULL, ADD COLUMN "b" INT NOT NULL DEFAULT 0;';
  assert.deepEqual(kinds(sql), ['adds a required column with no default']);
});

test('a required column WITH a default is additive', () => {
  assert.deepEqual(
    kinds(`ALTER TABLE "Invoice" ADD COLUMN "b" INT NOT NULL DEFAULT 0;`),
    [],
  );
});

test('ADD COLUMN IF NOT EXISTS is not read as NOT NULL', () => {
  assert.deepEqual(kinds('ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "patient" JSONB;'), []);
});

test('tightening an existing column to NOT NULL is a hazard', () => {
  assert.deepEqual(
    kinds('ALTER TABLE "CodeEntry" ALTER COLUMN "code" SET NOT NULL;'),
    ['makes an existing column NOT NULL'],
  );
});

test('relaxing a column to NULL is not', () => {
  assert.deepEqual(kinds('ALTER TABLE "CodeEntry" ALTER COLUMN "code" DROP NOT NULL;'), []);
});

test('a column type change is a hazard', () => {
  assert.deepEqual(
    kinds('ALTER TABLE "Invoice" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(10,2);'),
    ['changes a column type'],
  );
});

test('dropped tables, types, views and schemas are hazards', () => {
  assert.deepEqual(kinds('DROP TABLE "Legacy";'), ['drops a table']);
  assert.deepEqual(kinds('DROP TYPE "OldEnum";'), ['drops an enum type']);
  assert.deepEqual(kinds('DROP VIEW "InvoiceSummary";'), ['drops a view']);
  assert.deepEqual(kinds('DROP SCHEMA "legacy" CASCADE;'), ['drops a schema']);
  assert.deepEqual(kinds('TRUNCATE TABLE "CodeEntry";'), ['truncates a table']);
});

test('creating an index or a constraint is additive', () => {
  // The deliberate non-hazards. If these ever start firing the gate becomes
  // noise, and noise is how a gate gets turned off.
  assert.deepEqual(kinds('CREATE UNIQUE INDEX "Invoice_key" ON "Invoice"("id");'), []);
  assert.deepEqual(kinds('DROP INDEX "Invoice_key";'), []);
  assert.deepEqual(kinds('ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_fk";'), []);
});

test('a line comment describing a drop is not mistaken for one', () => {
  // Migration files are commented in the same words as the SQL they describe,
  // so a substring match over the raw file fires on the prose.
  const sql = '-- AlterTable: this used to DROP COLUMN "note", see #2599\nSELECT 1;';
  assert.deepEqual(kinds(sql), []);
});

test("a doubled quote inside a literal needs no special case", () => {
  // Pinned because the scanner deliberately has no '' branch. Closing the
  // literal at the first quote and reopening at the second spans exactly the
  // same text, so the `--` here can never surface outside a literal and eat the
  // statement that follows. If that ever stops being true this goes red.
  const sql = `INSERT INTO "Note" ("body") VALUES ('it''s -- fine'); DROP TABLE "Legacy";`;
  assert.deepEqual(kinds(sql), ['drops a table']);
  assert.ok(stripSqlComments(sql).includes("it''s -- fine"));
});

test('stripSqlComments keeps a literal that contains a comment marker', () => {
  // Blanking or truncating here would drop the DROP TABLE that follows.
  const sql = `INSERT INTO "Note" ("body") VALUES ('a -- not a comment');\nDROP TABLE "Legacy";`;
  const stripped = stripSqlComments(sql);
  assert.ok(stripped.includes('a -- not a comment'), stripped);
  assert.deepEqual(kinds(sql), ['drops a table']);
});

test('stripSqlComments handles nested block comments', () => {
  // Postgres nests them. Scanning for the first */ ends the comment at the
  // INNER close, and everything between it and the outer close - the DDL below
  // - re-enters the text as live SQL and is reported as a hazard that is not
  // there.
  const sql = '/* outer /* inner */ ALTER TABLE "X" DROP COLUMN "y"; */ SELECT 1;';
  assert.deepEqual(kinds(sql), []);
});

test('stripSqlComments preserves line count so reported SQL stays locatable', () => {
  const sql = '-- one\n/* two\nthree */\nSELECT 1;';
  assert.equal(stripSqlComments(sql).split('\n').length, sql.split('\n').length);
});

test('splitStatements ignores a semicolon inside a literal', () => {
  assert.equal(splitStatements(`SELECT 'a;b'; SELECT 2;`).length, 2);
});

test('readDeclaration joins continuation lines', () => {
  const sql = [
    '-- deployed-code-survives: the replacement column shipped in',
    '--   20260901120000_add_new_name and every reader moved in #2610,',
    '--   so no deployed query names the old one.',
    'ALTER TABLE "Invoice" DROP COLUMN "old";',
  ].join('\n');

  const declaration = readDeclaration(sql);
  assert.match(declaration, /^the replacement column shipped in 20260901120000_add_new_name/);
  assert.match(declaration, /no deployed query names the old one\.$/);
});

test('readDeclaration returns null when the marker is absent or empty', () => {
  assert.equal(readDeclaration('ALTER TABLE "Invoice" DROP COLUMN "old";'), null);
  assert.equal(readDeclaration('-- deployed-code-survives:\nSELECT 1;'), null);
});

test('a hazard with no declaration fails', () => {
  const review = reviewMigration({ name: 'm', sql: 'ALTER TABLE "Invoice" DROP COLUMN "old";' });
  assert.equal(review.verdict, 'undeclared');
});

test('a hazard with a real declaration passes', () => {
  const sql = [
    '-- deployed-code-survives: nothing reads this column; the last reader was',
    '--   removed in #2610 and the table holds zero rows in production.',
    'ALTER TABLE "Invoice" DROP COLUMN "old";',
  ].join('\n');
  assert.equal(reviewMigration({ name: 'm', sql }).verdict, 'ok');
});

test('a token declaration is refused', () => {
  // The whole point: "-- deployed-code-survives: ok" satisfies a presence check
  // while saying nothing a reviewer can disagree with.
  const sql = '-- deployed-code-survives: ok\nALTER TABLE "Invoice" DROP COLUMN "old";';
  const review = reviewMigration({ name: 'm', sql });
  assert.equal(review.verdict, 'declaration-too-short');
  assert.ok(review.declaration.length < MIN_DECLARATION_LENGTH);
});

test('an additive migration needs no declaration', () => {
  const review = reviewMigration({ name: 'm', sql: 'ALTER TABLE "Invoice" ADD COLUMN "note" TEXT;' });
  assert.equal(review.verdict, 'ok');
  assert.equal(review.declaration, null);
});

test('migrationName reads the directory, which is what Prisma checksums', () => {
  assert.equal(
    migrationName('packages/database/prisma/migrations/20260901120000_atcvet_code_system/migration.sql'),
    '20260901120000_atcvet_code_system',
  );
});

test('every hazard reports the statement that caused it', () => {
  const [hazard] = classifyMigrationSql('ALTER TABLE\n  "Invoice"\n  DROP COLUMN "old";');
  // Whitespace-collapsed, so a statement split over lines is still one readable
  // line in the CI log.
  assert.equal(hazard.statement, 'ALTER TABLE "Invoice" DROP COLUMN "old"');
});
