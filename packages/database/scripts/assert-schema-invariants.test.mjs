import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    cwd: packageRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
    input: options.input,
  });

const sql = (statement) => {
  const result = run(
    'pnpm',
    ['exec', 'prisma', 'db', 'execute', '--stdin', '--schema', 'prisma/schema.prisma'],
    {
      input: statement,
    }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
};

const assertInvariants = () => run('pnpm', ['run', 'schema:assert']);

const expectInvariantFailure = (name) => {
  const result = assertInvariants();
  assert.notEqual(result.status, 0, 'schema assertion unexpectedly passed');
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(`schema invariant ${name} failed`));
};

const restorePaymentIntentIndex = () => {
  sql('DROP INDEX IF EXISTS "Invoice_providerPaymentIntentId_key"');
  sql(
    'CREATE UNIQUE INDEX "Invoice_providerPaymentIntentId_key" ON "Invoice"("providerPaymentIntentId")'
  );
};

test('accepts the migrated schema', () => {
  const result = assertInvariants();
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('rejects a non-unique payment-intent fallback index', () => {
  try {
    sql('DROP INDEX "Invoice_providerPaymentIntentId_key"');
    sql(
      'CREATE INDEX "Invoice_providerPaymentIntentId_key" ON "Invoice"("providerPaymentIntentId")'
    );
    expectInvariantFailure('invoice_payment_intent_unique');
  } finally {
    restorePaymentIntentIndex();
  }
});

test('rejects an invalid payment-intent index left by an interrupted build', () => {
  try {
    sql('DROP INDEX "Invoice_providerPaymentIntentId_key"');
    sql(`
      INSERT INTO "Invoice"
        ("id", "items", "subtotal", "totalAmount", "currency", "providerPaymentIntentId", "updatedAt")
      VALUES
        ('schema-guard-invalid-1', '[]'::jsonb, 1, 1, 'schema-guard-test', 'pi_schema_guard', now()),
        ('schema-guard-invalid-2', '[]'::jsonb, 2, 2, 'schema-guard-test', 'pi_schema_guard', now())
    `);
    const build = run(
      'pnpm',
      ['exec', 'prisma', 'db', 'execute', '--stdin', '--schema', 'prisma/schema.prisma'],
      {
        input:
          'CREATE UNIQUE INDEX CONCURRENTLY "Invoice_providerPaymentIntentId_key" ON "Invoice"("providerPaymentIntentId")',
      }
    );
    assert.notEqual(build.status, 0, 'duplicate rows should make the concurrent unique build fail');
    expectInvariantFailure('invoice_payment_intent_unique');
  } finally {
    sql('DELETE FROM "Invoice" WHERE "currency" = \'schema-guard-test\'');
    restorePaymentIntentIndex();
  }
});

test('rejects a public table with row level security disabled', () => {
  try {
    sql('ALTER TABLE "Invoice" DISABLE ROW LEVEL SECURITY');
    expectInvariantFailure('rls_enabled_on_all_tables');
  } finally {
    sql('ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY');
  }
});
