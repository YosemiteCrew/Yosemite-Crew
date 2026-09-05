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
  assert.deepEqual(kinds('-- AlterTable\nALTER TABLE "Invoice" ADD COLUMN "note" TEXT;'), []);
});

test('a dropped column is a hazard', () => {
  assert.deepEqual(kinds('ALTER TABLE "Invoice" DROP COLUMN "note";'), ['drops a column']);
});

test('a renamed column is a hazard - the #2599 shape', () => {
  // #2599 renamed three columns. It was safe because all three tables held zero
  // rows, which is a fact about that PR, not about renames.
  assert.deepEqual(kinds('ALTER TABLE "Invoice" RENAME COLUMN "old" TO "new";'), [
    'renames a column',
  ]);
});

// The false positive that would have made this gate useless. Prisma writes this
// header on precisely the migrations worth catching, and
// 20260615100345_parent_patient_migration in this repo carries a real one.
test("Prisma's warning header is not mistaken for the statement", () => {
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
    'packages/database/prisma/migrations/20260615100345_parent_patient_migration/migration.sql'
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
  assert.deepEqual(kinds('ALTER TYPE "CodeSystem" RENAME TO "CodeSystemV2";'), [
    'renames an enum type',
  ]);
});

test('renaming a constraint is not mistaken for renaming a table', () => {
  assert.deepEqual(kinds('ALTER TABLE "Invoice" RENAME CONSTRAINT "a" TO "b";'), []);
});

test('a required column with no default is caught beside one that has a default', () => {
  // Asking whether DEFAULT appears anywhere in the statement clears the first
  // clause on the strength of the second.
  const sql =
    'ALTER TABLE "Invoice" ADD COLUMN "a" TEXT NOT NULL, ADD COLUMN "b" INT NOT NULL DEFAULT 0;';
  assert.deepEqual(kinds(sql), ['adds a required column with no default']);
});

test('a required column WITH a default is additive', () => {
  assert.deepEqual(kinds(`ALTER TABLE "Invoice" ADD COLUMN "b" INT NOT NULL DEFAULT 0;`), []);
});

test('ADD COLUMN IF NOT EXISTS is not read as NOT NULL', () => {
  assert.deepEqual(kinds('ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "patient" JSONB;'), []);
});

test('tightening an existing column to NOT NULL is a hazard', () => {
  assert.deepEqual(kinds('ALTER TABLE "CodeEntry" ALTER COLUMN "code" SET NOT NULL;'), [
    'makes an existing column NOT NULL',
  ]);
});

test('relaxing a column to NULL is not', () => {
  assert.deepEqual(kinds('ALTER TABLE "CodeEntry" ALTER COLUMN "code" DROP NOT NULL;'), []);
});

test('a column type change is a hazard', () => {
  assert.deepEqual(
    kinds('ALTER TABLE "Invoice" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(10,2);'),
    ['changes a column type']
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

test('a doubled quote inside a literal needs no special case', () => {
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

// The gate bypass Aikido found on this change: a plain substring search over
// the raw file let the marker text inside DATA clear the hazard beside it.
test('the marker inside a string literal is not a declaration', () => {
  const sql = [
    `INSERT INTO "Note" ("body") VALUES ('deployed-code-survives: this is data, not a promise');`,
    'ALTER TABLE "Invoice" DROP COLUMN "old";',
  ].join('\n');

  assert.equal(readDeclaration(sql), null);
  assert.equal(reviewMigration({ name: 'm', sql }).verdict, 'undeclared');
});

test('a comment that only mentions the marker is not a declaration', () => {
  const sql = [
    '-- see the deployed-code-survives: convention in _migration.yaml',
    'ALTER TABLE "Invoice" DROP COLUMN "old";',
  ].join('\n');

  assert.equal(readDeclaration(sql), null);
});

test('the marker is recognised however the comment is indented', () => {
  const sql = [
    '   --   deployed-code-survives: nothing has read this column since #2610,',
    '--   and the table holds zero rows in production.',
    'ALTER TABLE "Invoice" DROP COLUMN "old";',
  ].join('\n');

  assert.equal(reviewMigration({ name: 'm', sql }).verdict, 'ok');
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
  const review = reviewMigration({
    name: 'm',
    sql: 'ALTER TABLE "Invoice" ADD COLUMN "note" TEXT;',
  });
  assert.equal(review.verdict, 'ok');
  assert.equal(review.declaration, null);
});

test('migrationName reads the directory, which is what Prisma checksums', () => {
  assert.equal(
    migrationName(
      'packages/database/prisma/migrations/20260901120000_atcvet_code_system/migration.sql'
    ),
    '20260901120000_atcvet_code_system'
  );
});

test('every hazard reports the statement that caused it', () => {
  const [hazard] = classifyMigrationSql('ALTER TABLE\n  "Invoice"\n  DROP COLUMN "old";');
  // Whitespace-collapsed, so a statement split over lines is still one readable
  // line in the CI log.
  assert.equal(hazard.statement, 'ALTER TABLE "Invoice" DROP COLUMN "old"');
});

// The access dimension (#2724). These statements change no object's shape, so
// every rule above passes them - and on a table with no policies the first one
// takes every row out of the running code's sight the moment it commits.
//
// They are also the hazards CI cannot check dynamically: the migration job
// connects as `postgres` and a table's owner bypasses row-level security, so a
// test that applied one of these and read a row would pass here whatever it
// would do in production. The classification IS the check.

test('forcing row-level security is a hazard, and lifting it is not', () => {
  assert.deepEqual(kinds('ALTER TABLE "Appointment" FORCE ROW LEVEL SECURITY;'), [
    'removes the owner bypass on row-level security',
  ]);
  // NO FORCE contains FORCE, so a substring search would report the reverse of
  // what this statement does.
  assert.deepEqual(kinds('ALTER TABLE "Appointment" NO FORCE ROW LEVEL SECURITY;'), []);
});

test('enabling row-level security is a hazard, and disabling it is not', () => {
  assert.deepEqual(kinds('ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;'), [
    'enables row-level security',
  ]);
  assert.deepEqual(kinds('ALTER TABLE "Appointment" DISABLE ROW LEVEL SECURITY;'), []);
});

test('revoking is a hazard, granting is not', () => {
  assert.deepEqual(kinds('REVOKE ALL ON "Appointment" FROM PUBLIC;'), ['revokes a privilege']);
  assert.deepEqual(kinds('GRANT SELECT ON "Appointment" TO app_readonly;'), []);
});

test('changing an object owner is a hazard - it moves the row-level bypass', () => {
  assert.deepEqual(kinds('ALTER TABLE "Appointment" OWNER TO app_readonly;'), [
    'changes an object owner',
  ]);
});

test('a restrictive policy narrows and is a hazard; a permissive one does not', () => {
  assert.deepEqual(kinds('CREATE POLICY tenant ON "Appointment" AS RESTRICTIVE USING (false);'), [
    'narrows or removes a row-level policy',
  ]);
  // On an RLS table with no policies, a permissive policy is the difference
  // between seeing nothing and seeing something.
  assert.deepEqual(kinds('CREATE POLICY tenant ON "Appointment" USING (true);'), []);
  assert.deepEqual(kinds('DROP POLICY tenant ON "Appointment";'), [
    'narrows or removes a row-level policy',
  ]);
});

test('removing a role or what it owns is a hazard', () => {
  assert.deepEqual(kinds('DROP OWNED BY app_user;'), ['drops objects owned by a role']);
  assert.deepEqual(kinds('ALTER ROLE app_user NOLOGIN;'), [
    'removes a role or its ability to connect',
  ]);
  assert.deepEqual(kinds('DROP ROLE app_user;'), ['removes a role or its ability to connect']);
});

test('ALTER DEFAULT PRIVILEGES is not a hazard - it cannot change what is read today', () => {
  assert.deepEqual(
    kinds('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_readonly;'),
    []
  );
  // The REVOKE form is the one that mattered: the GRANT form above agrees with
  // the exclusion whether or not the exclusion exists, because no rule here
  // matches GRANT. Only this input can tell the two apart.
  assert.deepEqual(
    kinds('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;'),
    []
  );
  assert.deepEqual(
    kinds('ALTER DEFAULT PRIVILEGES FOR ROLE app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;'),
    []
  );
  // And a plain REVOKE is still a hazard - the exclusion is scoped, not a hole.
  assert.deepEqual(kinds('REVOKE ALL ON "Appointment" FROM PUBLIC;'), ['revokes a privilege']);
});

test('access hazards are tagged as such, so the report can name the right thing', () => {
  const [access] = classifyMigrationSql('ALTER TABLE "Appointment" FORCE ROW LEVEL SECURITY;');
  const [shape] = classifyMigrationSql('ALTER TABLE "Appointment" DROP COLUMN "notes";');
  assert.equal(access.dimension, 'access');
  assert.equal(shape.dimension, 'shape');
});

test('an access hazard needs a declaration like any other', () => {
  const undeclared = reviewMigration({
    name: 'm',
    sql: 'ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;',
  });
  assert.equal(undeclared.verdict, 'undeclared');

  const declared = reviewMigration({
    name: 'm',
    sql:
      '-- deployed-code-survives: the API connects as the owning role, which bypasses\n' +
      '--   row-level security, so its reads are unaffected.\n' +
      'ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;',
  });
  assert.equal(declared.verdict, 'ok');
});

// The access rules are a predicate over SQL text, so what matters is not the
// seven spellings in the tests above but whether a real migration can say the
// same thing and slip past. These are the forms this repo's migrations and
// Prisma actually emit.

test('access rules see through schema qualifiers, case, line breaks and DO blocks', () => {
  assert.deepEqual(kinds('ALTER TABLE public."Appointment" FORCE ROW LEVEL SECURITY;'), [
    'removes the owner bypass on row-level security',
  ]);
  assert.deepEqual(kinds('alter table "Appointment" enable row level security;'), [
    'enables row-level security',
  ]);
  assert.deepEqual(kinds('ALTER TABLE "Appointment"\n  FORCE ROW LEVEL\n  SECURITY;'), [
    'removes the owner bypass on row-level security',
  ]);
  // DDL executed from a string inside a DO block is why stripSqlComments leaves
  // literals intact; the access rules inherit that and must not miss it.
  assert.deepEqual(
    kinds(`DO $$ BEGIN EXECUTE 'ALTER TABLE "X" FORCE ROW LEVEL SECURITY'; END $$;`),
    ['removes the owner bypass on row-level security']
  );
  assert.deepEqual(kinds('ALTER TABLE IF EXISTS "Appointment" ENABLE ROW LEVEL SECURITY;'), [
    'enables row-level security',
  ]);
});

test('an owner change is caught on any object, not just a table', () => {
  assert.deepEqual(kinds('ALTER SEQUENCE "Appointment_id_seq" OWNER TO app_user;'), [
    'changes an object owner',
  ]);
  assert.deepEqual(kinds('ALTER VIEW "v" OWNER TO app_user;'), ['changes an object owner']);
});

test('a wholesale REVOKE is caught', () => {
  assert.deepEqual(kinds('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_readonly;'), [
    'revokes a privilege',
  ]);
});

// Both halves of this are the file's existing trade rather than anything the
// access rules introduce, and the assertions are paired so they stay that way:
// comments are stripped, so prose about a hazard is not one; string literals
// are NOT, because a DO block's DDL lives in one, so a hazard word inside a
// literal reports. An access rule behaves exactly as a shape rule does here.
test('access rules inherit the comment and literal handling, unchanged', () => {
  const inComment = (phrase) => `-- we had to ${phrase}\nALTER TABLE "A" ADD COLUMN "b" TEXT;`;
  const inLiteral = (phrase) => `INSERT INTO "Audit" ("note") VALUES ('we had to ${phrase}');`;

  assert.deepEqual(kinds(inComment('DROP COLUMN x')), []);
  assert.deepEqual(kinds(inComment('REVOKE ALL on x')), []);

  assert.deepEqual(kinds(inLiteral('DROP COLUMN x')), ['drops a column']);
  assert.deepEqual(kinds(inLiteral('REVOKE ALL on x')), ['revokes a privilege']);
});

// SECURITY LABEL is the one access-adjacent statement not covered, and it is
// out on purpose: it does nothing without a label provider (selinux, anon) and
// none is configured on this database. Pinned so that changing the answer is a
// decision rather than a side effect of widening a pattern.
test('SECURITY LABEL is not flagged', () => {
  assert.deepEqual(kinds(`SECURITY LABEL FOR selinux ON TABLE "Appointment" IS 'x';`), []);
});

// Three statements that mean what a rule above means and did not match it.
// Raised by ankit-yc reviewing #2731, and each is one entry rather than a new
// concept - which is the test of whether the dimension is real.

test('REASSIGN OWNED BY is an owner change, in bulk', () => {
  // OWNER TO applied to every object a role owns. On this database that is the
  // one statement that takes all eleven row-level-security tables out of the
  // API's sight at once, since every one rests on the owner bypass.
  assert.deepEqual(kinds('REASSIGN OWNED BY app_role TO other_role;'), ['changes an object owner']);
});

test('CONNECTION LIMIT 0 locks a role out; a positive limit does not', () => {
  assert.deepEqual(kinds('ALTER ROLE app_role CONNECTION LIMIT 0;'), [
    'removes a role or its ability to connect',
  ]);
  // A cap is not a lockout, and -1 is the default meaning no limit at all.
  assert.deepEqual(kinds('ALTER ROLE app_role CONNECTION LIMIT 10;'), []);
  assert.deepEqual(kinds('ALTER ROLE app_role CONNECTION LIMIT -1;'), []);
});

test('moving an object to another schema is a hazard, and a shape one', () => {
  // The object still exists and its grants are unchanged, so this is not an
  // access change - but a deployed query naming it unqualified stops resolving.
  const [hazard] = classifyMigrationSql('ALTER TABLE "X" SET SCHEMA hidden;');
  assert.equal(hazard.kind, 'moves an object to another schema');
  assert.equal(hazard.dimension, 'shape');
  // IN SCHEMA is not SET SCHEMA.
  assert.deepEqual(
    kinds('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO r;'),
    []
  );
});

// ALTER USER and DROP USER are exact aliases for ALTER ROLE and DROP ROLE in
// PostgreSQL, not near synonyms, so matching one spelling matches half the
// language. Raised by ankit-yc reviewing #2731.
test('the role rule matches the USER spelling too', () => {
  for (const spelling of ['ROLE', 'USER']) {
    assert.deepEqual(kinds(`ALTER ${spelling} app_role NOLOGIN;`), [
      'removes a role or its ability to connect',
    ]);
    assert.deepEqual(kinds(`ALTER ${spelling} app_role CONNECTION LIMIT 0;`), [
      'removes a role or its ability to connect',
    ]);
    assert.deepEqual(kinds(`DROP ${spelling} app_role;`), [
      'removes a role or its ability to connect',
    ]);
    // Still a cap rather than a lockout in either spelling.
    assert.deepEqual(kinds(`ALTER ${spelling} app_role CONNECTION LIMIT 10;`), []);
  }
  // A padded zero is still zero; `\b` alone could not see it.
  assert.deepEqual(kinds('ALTER USER app_role CONNECTION LIMIT 00;'), [
    'removes a role or its ability to connect',
  ]);
});
