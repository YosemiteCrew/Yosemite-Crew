import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

const assertSafeMutationTarget = (
  databaseUrl = process.env.DATABASE_URL,
  allowRemote = process.env.ALLOW_DESTRUCTIVE_SCHEMA_INVARIANT_TESTS === '1'
) => {
  assert.ok(databaseUrl, 'DATABASE_URL is required for destructive schema invariant tests');
  const url = new URL(databaseUrl);
  // Measured against Prisma 6.19.3: query `host` overrides the authority host,
  // and a leading `/` identifies a Unix socket directory.
  const target = url.searchParams.get('host') ?? url.hostname;
  assert.ok(
    allowRemote ||
      target.startsWith('/') ||
      ['', 'localhost', '127.0.0.1', '::1', '[::1]'].includes(target),
    'destructive schema invariant tests require a local database; set ALLOW_DESTRUCTIVE_SCHEMA_INVARIANT_TESTS=1 to opt in'
  );
};

assertSafeMutationTarget();
if (process.env.SCHEMA_INVARIANT_IMPORT_PROBE === '1') {
  process.exit(93);
}

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

test('refuses a remote mutation target without explicit opt-in', () => {
  assert.throws(
    () => assertSafeMutationTarget('postgresql://db.example.test/yosemite', false),
    /require a local database/
  );
  assert.doesNotThrow(() =>
    assertSafeMutationTarget('postgresql://db.example.test/yosemite', true)
  );
  assert.doesNotThrow(() => assertSafeMutationTarget('postgresql:///yosemite', false));
  assert.throws(
    () =>
      assertSafeMutationTarget('postgresql://localhost:5432/yosemite?host=db.example.test', false),
    /require a local database/
  );
});

test('refuses at import when DATABASE_URL is remote', () => {
  const env = {
    ...process.env,
    DATABASE_URL: 'postgresql://db.prod.example.test/yosemite',
    ALLOW_DESTRUCTIVE_SCHEMA_INVARIANT_TESTS: '',
    SCHEMA_INVARIANT_IMPORT_PROBE: '1',
  };
  delete env.NODE_TEST_CONTEXT;
  const result = run(process.execPath, ['scripts/assert-schema-invariants.test.mjs'], { env });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /require a local database/);
});

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
