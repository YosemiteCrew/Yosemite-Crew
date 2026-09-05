#!/usr/bin/env node
/**
 * Fails a pull request that adds a migration whose SQL breaks the code that is
 * already deployed, unless the migration says in writing why it does not.
 *
 * The hazard is a property of how this repository deploys, not of any one
 * migration. `scripts/deploy/api-deploy.sh` applies migrations and then boots
 * and smoke-tests the new bundle before `pm2 restart` cuts over, so the OLD
 * process serves traffic against the NEW schema for the length of that window -
 * and if the smoke boot fails the script deliberately does not cut over, which
 * leaves the old process on the new schema indefinitely. The rollback restores
 * the code. Nothing rolls back the schema.
 *
 * Additive migrations are unaffected, which is why this has not bitten yet.
 * A migration that removes or renames something a running query still names
 * turns every request touching that table into a 500 for the length of the
 * window, and a failed deploy makes that permanent until someone intervenes.
 *
 * Raised by the Codex review on #2599, which renames three columns. That PR was
 * safe on its own terms - all three tables held zero rows - but the hazard is
 * general and applies to the first rename on a populated table.
 *
 * The declaration this asks for is the expand-contract step made explicit:
 *
 *     -- deployed-code-survives: the replacement column shipped in
 *     --   20260901120000_add_new_name and the reader was updated in #2610, so
 *     --   no deployed query names the old one.
 *
 * That is a claim a reviewer can check, sitting in the diff next to the SQL it
 * describes. It is not a suppression switch: the hazard is still reported, and
 * the text is what a reviewer reads before approving.
 *
 *   node scripts/ci/classify-migration.mjs <migration.sql...>
 *
 * Exits non-zero if any file has a hazard with no declaration.
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWithin } from './safe-path.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The marker that declares a hazard survivable, and the floor its explanation
 * has to clear. The floor exists because "-- deployed-code-survives: ok" would
 * satisfy a bare presence check while saying nothing, and this gate is only
 * worth having if the sentence it forces is one a reviewer can disagree with.
 */
export const DECLARATION_MARKER = 'deployed-code-survives:';
export const MIN_DECLARATION_LENGTH = 30;

/**
 * Removes SQL comments, leaving string and identifier literals intact.
 *
 * Both halves matter and they pull in opposite directions:
 *
 *   Comments MUST go. Prisma writes a warning header on exactly the migrations
 *   this gate cares about - "You are about to drop the column `companion` on
 *   the `AdverseEventReport` table" - and a substring match over the raw file
 *   would fire on that prose whether or not the statement below it survives.
 *   20260615100345_parent_patient_migration is a real example in this repo.
 *
 *   Literals MUST STAY. Migrations here run DDL out of a string inside a DO
 *   block (`EXECUTE 'UPDATE "AdverseEventReport" SET ...'`, same file), so
 *   blanking literal bodies - the obvious way to stop a `--` inside a string
 *   being read as a comment - would hide the very statements that are most
 *   worth catching.
 *
 * So this tracks quoting only well enough to know when a `--` or a `/*` is
 * really a comment: inside '...' or "..." it is not. Postgres block comments
 * nest, so the depth is counted rather than scanning for the first close.
 *
 * Dollar-quoted bodies ($$ ... $$) are deliberately NOT treated as opaque. A DO
 * block's body is ordinary SQL, comments inside it are real comments, and its
 * statements are real statements.
 */
export const stripSqlComments = (sql) => {
  let out = '';
  let i = 0;

  while (i < sql.length) {
    const pair = sql.slice(i, i + 2);

    if (pair === '--') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      // The newline itself is left for the next pass, so line structure - and
      // therefore the reported line numbers - survive.
      continue;
    }

    if (pair === '/*') {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql.slice(i, i + 2) === '/*') {
          depth += 1;
          i += 2;
          continue;
        }
        if (sql.slice(i, i + 2) === '*/') {
          depth -= 1;
          i += 2;
          continue;
        }
        // Newlines inside the comment are kept so line numbers do not shift.
        if (sql[i] === '\n') out += '\n';
        i += 1;
      }
      out += ' ';
      continue;
    }

    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      out += quote;
      i += 1;
      // A doubled quote ('' inside a literal) needs no special case: closing at
      // the first and reopening at the second covers exactly the same text, so
      // no `--` can surface outside a literal between them.
      while (i < sql.length) {
        if (sql[i] === quote) {
          out += quote;
          i += 1;
          break;
        }
        out += sql[i];
        i += 1;
      }
      continue;
    }

    out += sql[i];
    i += 1;
  }

  return out;
};

/**
 * Splits comment-free SQL into statements on `;`, ignoring one inside a literal.
 *
 * Statement scope only matters for the three rules below that need two keywords
 * together - ALTER TABLE + RENAME TO, ALTER TYPE + RENAME TO, and the ADD COLUMN
 * clauses. Every other rule is a single keyword and survives any split.
 *
 * A dollar-quoted body ($$ ... $$) is deliberately NOT held together. Splitting
 * inside one gives TIGHTER statements, and tighter is the safe direction here: a
 * DO block that renames an index in one branch and alters a table in another
 * would, held whole, satisfy `ALTER TABLE` and `RENAME TO` at once and report a
 * table rename that is not there. Real `ALTER TABLE ... RENAME TO` is a single
 * statement either way, so nothing is lost.
 */
export const splitStatements = (sql) => {
  const statements = [];
  let current = '';
  let i = 0;

  while (i < sql.length) {
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      current += quote;
      i += 1;
      // Doubled quotes re-pair on their own; see stripSqlComments.
      while (i < sql.length) {
        if (sql[i] === quote) {
          current += quote;
          i += 1;
          break;
        }
        current += sql[i];
        i += 1;
      }
      continue;
    }

    if (sql[i] === ';') {
      statements.push(current);
      current = '';
      i += 1;
      continue;
    }

    current += sql[i];
    i += 1;
  }

  statements.push(current);
  return statements.filter((s) => s.trim() !== '');
};

const normalise = (statement) => statement.replace(/\s+/g, ' ').trim().toUpperCase();

/**
 * Every clause introduced by ADD COLUMN, so a required column with no default
 * is still found when it shares a statement with a column that has one.
 * `ALTER TABLE "X" ADD COLUMN "a" TEXT NOT NULL, ADD COLUMN "b" INT DEFAULT 0`
 * is one statement, and asking whether DEFAULT appears anywhere in it would
 * clear the first clause on the strength of the second.
 */
const addColumnClauses = (upper) => upper.split('ADD COLUMN').slice(1);

/**
 * What "the deployed code stops working" looks like in SQL.
 *
 * Deliberately NOT here, because neither breaks a running query:
 *   DROP INDEX      - costs a plan, not a result. `ALTER INDEX ... RENAME TO`
 *                     likewise: index names appear in no application query, and
 *                     Prisma emits them routinely, so flagging them would make
 *                     this gate noise. That is why the table rename below has
 *                     to check for ALTER TABLE rather than matching RENAME TO
 *                     on its own.
 *   DROP CONSTRAINT - old code keeps reading and writing. Dropping a UNIQUE
 *                     changes what a race can produce, which is a correctness
 *                     question for review, not a break at cutover.
 *
 * ALTER TYPE ... RENAME TO is here: Prisma sends enum values with an explicit
 * cast to the type name, so a deployed client keeps naming the old type.
 */
const RULES = [
  { kind: 'drops a table', test: (u) => u.includes('DROP TABLE') },
  { kind: 'drops a column', test: (u) => u.includes('DROP COLUMN') },
  { kind: 'renames a column', test: (u) => u.includes('RENAME COLUMN') },
  { kind: 'renames a table', test: (u) => u.includes('ALTER TABLE') && u.includes('RENAME TO') },
  {
    kind: 'renames an enum type',
    test: (u) => u.includes('ALTER TYPE') && u.includes('RENAME TO'),
  },
  { kind: 'drops an enum type', test: (u) => u.includes('DROP TYPE') },
  { kind: 'drops a view', test: (u) => u.includes('DROP VIEW') },
  { kind: 'drops a schema', test: (u) => u.includes('DROP SCHEMA') },
  { kind: 'truncates a table', test: (u) => u.includes('TRUNCATE') },
  {
    kind: 'makes an existing column NOT NULL',
    test: (u) => u.includes('SET NOT NULL'),
  },
  {
    kind: 'changes a column type',
    test: (u) => u.includes('SET DATA TYPE') || (u.includes('ALTER COLUMN') && /\bTYPE\b/.test(u)),
  },
  {
    kind: 'adds a required column with no default',
    test: (u) => addColumnClauses(u).some((c) => c.includes('NOT NULL') && !c.includes('DEFAULT')),
  },
];

/**
 * The hazards in one migration's SQL, as {kind, statement} pairs.
 * Exported so the classification that reds a build is testable on its own.
 */
export const classifyMigrationSql = (sql) => {
  const hazards = [];

  for (const statement of splitStatements(stripSqlComments(sql))) {
    const upper = normalise(statement);
    for (const rule of RULES) {
      if (rule.test(upper)) {
        hazards.push({ kind: rule.kind, statement: statement.replace(/\s+/g, ' ').trim() });
      }
    }
  }

  return hazards;
};

/**
 * A line comment whose first content IS the marker. Anchored on purpose.
 *
 * A plain substring search over the raw file was a gate bypass: the marker text
 * inside a string literal - `INSERT ... VALUES ('deployed-code-survives: ...')`
 * - would have been read as a declaration and cleared the hazardous statement
 * next to it. Raised by the Aikido review on this change.
 *
 * Requiring the comment to START with the marker also rules out a comment that
 * merely mentions it in passing. The cost is that a declaration written inside
 * a block comment is not recognised; the failure message names the `--` form,
 * and refusing an unrecognised declaration fails safe.
 */
const DECLARATION_LINE = new RegExp(`^\\s*--\\s*${DECLARATION_MARKER}`);

/**
 * The explanation attached to the marker, or null.
 *
 * Read from the RAW file, before comments are stripped - the declaration is
 * itself a comment. Continuation lines let the sentence be a sentence: the
 * marker line plus every `--` line immediately following it are joined.
 */
export const readDeclaration = (sql) => {
  const lines = sql.split('\n');
  const start = lines.findIndex((line) => DECLARATION_LINE.test(line));
  if (start === -1) return null;

  const first = lines[start].slice(
    lines[start].indexOf(DECLARATION_MARKER) + DECLARATION_MARKER.length
  );
  const parts = [first.trim()];

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('--')) break;
    parts.push(line.replace(/^--\s?/, '').trim());
  }

  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
};

/**
 * @returns {{name: string, hazards: Array, declaration: string|null,
 *            verdict: 'ok'|'undeclared'|'declaration-too-short'}}
 */
export const reviewMigration = ({ name, sql }) => {
  const hazards = classifyMigrationSql(sql);
  const declaration = readDeclaration(sql);

  if (hazards.length === 0) return { name, hazards, declaration, verdict: 'ok' };
  if (declaration === null) return { name, hazards, declaration, verdict: 'undeclared' };
  if (declaration.length < MIN_DECLARATION_LENGTH) {
    return { name, hazards, declaration, verdict: 'declaration-too-short' };
  }
  return { name, hazards, declaration, verdict: 'ok' };
};

/** `.../migrations/20260901120000_atcvet_code_system/migration.sql` -> the directory name. */
export const migrationName = (path) =>
  basename(path) === 'migration.sql' ? basename(dirname(path)) : path;

const main = (paths) => {
  if (paths.length === 0) {
    console.log('No new migrations in this pull request.');
    return 0;
  }

  let failed = 0;

  for (const path of paths) {
    // The CI step feeds this repo-relative paths straight out of
    // `git diff --name-only`, but it is a command-line script and the argument
    // is not otherwise constrained. resolveWithin is the same containment the
    // other scripts here apply to paths they did not author.
    const resolved = resolveWithin(repoRoot, path);
    if (resolved === null) {
      console.log(`::error::${path} resolves outside the repository.`);
      failed += 1;
      continue;
    }

    const review = reviewMigration({
      name: migrationName(relative(repoRoot, resolved)),
      sql: readFileSync(resolved, 'utf8'),
    });

    if (review.hazards.length === 0) {
      console.log(`ok  ${review.name}: additive only.`);
      continue;
    }

    const listed = review.hazards.map((h) => `      - ${h.kind}: ${h.statement}`).join('\n');

    if (review.verdict === 'ok') {
      console.log(`ok  ${review.name}: ${review.hazards.length} hazard(s), declared.`);
      console.log(listed);
      console.log(`      declared: ${review.declaration}`);
      continue;
    }

    failed += 1;
    console.log(
      `::error file=${path}::${review.name} changes the schema in a way the deployed code may not survive.`
    );
    console.log(listed);

    if (review.verdict === 'declaration-too-short') {
      console.log(`    The ${DECLARATION_MARKER} note is ${review.declaration.length} characters:`);
      console.log(`      "${review.declaration}"`);
      console.log(
        `    It needs at least ${MIN_DECLARATION_LENGTH} - enough to say something a reviewer can disagree with.`
      );
      continue;
    }

    console.log(`    api-deploy.sh applies migrations before it cuts over, so the CURRENTLY`);
    console.log(`    DEPLOYED code runs against this schema for the length of the smoke window -`);
    console.log(`    and for good, if the smoke boot fails and the deploy stops without cutting`);
    console.log(`    over. The code rollback does not roll the schema back.`);
    console.log(`    Either ship the expand step first (add the new thing, move the readers,`);
    console.log(`    remove the old thing in a later release), or say why no deployed reader`);
    console.log(`    names what this changes, in the migration itself:`);
    console.log(`      -- ${DECLARATION_MARKER} <why the deployed code keeps working>`);
  }

  if (failed > 0) {
    // Deliberately not "N migrations change the schema": a path that resolves
    // outside the repository counts here too, and was never read.
    console.log(`\n${failed} of ${paths.length} new migration(s) did not pass.`);
    return 1;
  }

  console.log(`\nEvery new migration is additive or explains how the deployed code survives it.`);
  return 0;
};

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
