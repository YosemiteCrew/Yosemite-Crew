import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { ClientStatementService } from "src/services/finance/client-statement";

jest.mock("src/config/prisma", () => ({
  get prisma() {
    return mockStatementDb;
  },
}));
jest.mock("src/services/finance/client-collections", () => ({
  resolvePracticeTimeZone: jest.fn().mockResolvedValue("UTC"),
}));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for these tests.");
const connection = new URL(databaseUrl);
const host = connection.searchParams.get("host") ?? connection.hostname;
if (
  !host.startsWith("/") &&
  !["localhost", "127.0.0.1", "[::1]"].includes(host)
) {
  throw new Error("These tests require a disposable local database.");
}

const schema = `invoice_history_${randomUUID().replaceAll("-", "")}`;
const writerRole = `invoice_writer_${randomUUID().replaceAll("-", "")}`;
connection.searchParams.set("schema", schema);
const isolatedUrl = connection.toString();
const admin = new PrismaClient();
const db = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
const mockStatementDb = db;
const root = resolve(__dirname, "../../..");
const legacyId = randomUUID();
const earlyDate = new Date("2001-01-01T00:00:00.000Z");
const baselineStart = Date.now();

const createInvoice = () =>
  db.invoice.create({
    data: {
      id: randomUUID(),
      organisationId: "history-practice",
      parentId: "history-client",
      items: [],
      subtotal: 100,
      totalAmount: 100,
      currency: "GBP",
    },
  });

const history = (invoiceId: string) =>
  db.invoiceRevision.findMany({
    where: { invoiceId },
    orderBy: { id: "asc" },
  });

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  for (const type of [
    "InvoiceStatus",
    "PaymentCollectionMethod",
    "BillingCollectionMode",
    "InvoiceVisitBillingStage",
    "TaxProvider",
    "PaymentStatus",
    "RefundStatus",
    "CreditNoteStatus",
    "ParentCreatedFrom",
    "PaymentProvider",
    "SettlementChannel",
  ]) {
    const [{ labels }] = await admin.$queryRawUnsafe<
      Array<{ labels: string[] }>
    >(`SELECT enum_range(NULL::"public"."${type}")::text[] AS labels`);
    const values = labels
      .map((label) => `'${label.replaceAll("'", "''")}'`)
      .join(", ");
    await admin.$executeRawUnsafe(
      `CREATE TYPE "${schema}"."${type}" AS ENUM (${values})`,
    );
  }
  for (const table of [
    "Invoice",
    "Payment",
    "Refund",
    "CreditNote",
    "Parent",
    "ClientStatement",
    "FinanceEvents",
  ]) {
    await admin.$executeRawUnsafe(
      `CREATE TABLE "${schema}"."${table}" (LIKE "public"."${table}" INCLUDING ALL)`,
    );
    const columns = await admin.$queryRaw<
      Array<{
        column_name: string;
        udt_name: string;
        column_default: string | null;
      }>
    >`
      SELECT column_name, udt_name, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
        AND data_type = 'USER-DEFINED'
    `;
    for (const column of columns) {
      const target = `"${schema}"."${table}"`;
      const name = `"${column.column_name}"`;
      const type = `"${schema}"."${column.udt_name}"`;
      await admin.$executeRawUnsafe(
        `ALTER TABLE ${target} ALTER COLUMN ${name} DROP DEFAULT`,
      );
      await admin.$executeRawUnsafe(
        `ALTER TABLE ${target} ALTER COLUMN ${name} TYPE ${type} USING ${name}::text::${type}`,
      );
      if (column.column_default !== null) {
        await admin.$executeRawUnsafe(
          `ALTER TABLE ${target} ALTER COLUMN ${name} SET DEFAULT (${column.column_default})::text::${type}`,
        );
      }
    }
  }
  await db.invoice.create({
    data: {
      id: legacyId,
      organisationId: "legacy-practice",
      parentId: "legacy-client",
      items: [],
      subtotal: 80,
      totalAmount: 80,
      currency: "EUR",
      status: "AWAITING_PAYMENT",
      finalizedAt: earlyDate,
      dueAt: earlyDate,
      createdAt: earlyDate,
      updatedAt: earlyDate,
    },
  });
  const migration = readFileSync(
    resolve(
      root,
      "packages/database/prisma/migrations/20261003190000_invoice_revisions/migration.sql",
    ),
    "utf8",
  );
  const result = spawnSync(
    process.execPath,
    [
      require.resolve("prisma/build/index.js"),
      "db",
      "execute",
      "--stdin",
      "--schema",
      resolve(root, "packages/database/prisma/schema.prisma"),
    ],
    {
      cwd: root,
      input: migration,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: isolatedUrl,
        DIRECT_URL: isolatedUrl,
      },
    },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  await admin.$executeRawUnsafe(`CREATE ROLE "${writerRole}"`);
  await admin.$executeRawUnsafe(
    `GRANT USAGE ON SCHEMA "${schema}" TO "${writerRole}"`,
  );
  await admin.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE ON "${schema}"."Invoice" TO "${writerRole}"`,
  );
}, 30_000);

afterAll(async () => {
  await db.$disconnect();
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS "${writerRole}"`);
  } finally {
    await admin.$disconnect();
  }
});

it("records a new invoice with its original account and charge", async () => {
  const start = Date.now();
  const invoice = await createInvoice();
  const versions = await history(invoice.id);
  expect(versions).toHaveLength(1);
  expect(versions[0]).toEqual(
    expect.objectContaining({
      invoiceId: invoice.id,
      organisationId: "history-practice",
      parentId: "history-client",
      totalAmount: 100,
      currency: "GBP",
      status: "PENDING",
      finalizedAt: null,
      dueAt: null,
      baseline: false,
    }),
  );
  expect(versions[0].recordedAt.getTime()).toBeGreaterThanOrEqual(start - 1);
  expect(versions[0].recordedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1);
});

it("marks existing invoices as a current baseline without inventing earlier history", async () => {
  const versions = await history(legacyId);
  expect(versions).toHaveLength(1);
  expect(versions[0]).toEqual(
    expect.objectContaining({
      organisationId: "legacy-practice",
      parentId: "legacy-client",
      totalAmount: 80,
      currency: "EUR",
      status: "AWAITING_PAYMENT",
      finalizedAt: earlyDate,
      dueAt: earlyDate,
      baseline: true,
    }),
  );
  expect(versions[0].recordedAt.getTime()).toBeGreaterThanOrEqual(
    baselineStart - 1,
  );
});

it.each([
  ["organisationId", "changed-practice"],
  ["parentId", "changed-client"],
  ["totalAmount", 150],
  ["currency", "EUR"],
  ["status", "CANCELLED"],
  ["finalizedAt", earlyDate],
  ["dueAt", earlyDate],
] as const)(
  "preserves the previous %s when it changes",
  async (field, value) => {
    const invoice = await createInvoice();
    const original = (await history(invoice.id))[0];
    await db.invoice.update({
      where: { id: invoice.id },
      data: { [field]: value },
    });
    const versions = await history(invoice.id);
    expect(versions).toHaveLength(2);
    expect(versions[0]).toEqual(original);
    expect(versions[1][field]).toEqual(value);
    expect(versions[1].baseline).toBe(false);
    expect(versions[1].id).toBeGreaterThan(versions[0].id);
  },
);

it("preserves finalization and due dates through reopening and later finalization", async () => {
  const invoice = await createInvoice();
  const later = new Date("2026-10-03T00:00:00.000Z");
  await db.invoice.update({
    where: { id: invoice.id },
    data: {
      finalizedAt: earlyDate,
      dueAt: earlyDate,
    },
  });
  await db.invoice.update({
    where: { id: invoice.id },
    data: {
      totalAmount: 150,
      finalizedAt: null,
      dueAt: null,
    },
  });
  await db.invoice.update({
    where: { id: invoice.id },
    data: {
      finalizedAt: later,
      dueAt: later,
    },
  });
  expect(
    (await history(invoice.id)).map(({ totalAmount, finalizedAt, dueAt }) => ({
      totalAmount,
      finalizedAt,
      dueAt,
    })),
  ).toEqual([
    { totalAmount: 100, finalizedAt: null, dueAt: null },
    { totalAmount: 100, finalizedAt: earlyDate, dueAt: earlyDate },
    { totalAmount: 150, finalizedAt: null, dueAt: null },
    { totalAmount: 150, finalizedAt: later, dueAt: later },
  ]);
});

it("does not add revisions for unchanged fields or unrelated invoice details", async () => {
  const invoice = await createInvoice();
  const original = await history(invoice.id);
  expect(original).toHaveLength(1);
  await db.invoice.update({
    where: { id: invoice.id },
    data: {
      totalAmount: 100,
      status: "PENDING",
      finalizedAt: null,
      dueAt: null,
    },
  });
  await db.invoice.update({
    where: { id: invoice.id },
    data: { metadata: { note: "Updated" } },
  });
  expect(await history(invoice.id)).toEqual(original);
});

it("dates amendments when they occur even if updatedAt is backdated", async () => {
  const invoice = await createInvoice();
  const start = Date.now();
  await db.invoice.update({
    where: { id: invoice.id },
    data: {
      totalAmount: 120,
      updatedAt: earlyDate,
    },
  });
  const versions = await history(invoice.id);
  expect(versions).toHaveLength(2);
  expect(versions[1].recordedAt.getTime()).toBeGreaterThanOrEqual(start - 1);
});

it("keeps a deterministic revision order for several changes in one transaction", async () => {
  const invoice = await createInvoice();
  await db.$transaction(async (tx) => {
    for (const totalAmount of [120, 110, 150]) {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { totalAmount },
      });
    }
  });
  expect(
    (await history(invoice.id)).map(({ totalAmount }) => totalAmount),
  ).toEqual([100, 120, 110, 150]);
});

it("rolls revisions back with an unsuccessful invoice amendment", async () => {
  const invoice = await createInvoice();
  const original = await history(invoice.id);
  await expect(
    db.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { totalAmount: 150 },
      });
      expect(
        await tx.invoiceRevision.count({ where: { invoiceId: invoice.id } }),
      ).toBe(2);
      throw new Error("Amendment cancelled");
    }),
  ).rejects.toThrow("Amendment cancelled");
  expect(await history(invoice.id)).toEqual(original);
  expect(
    (await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } }))
      .totalAmount,
  ).toBe(100);
});

it("retains earlier history if an invoice is removed", async () => {
  const invoice = await createInvoice();
  const original = await history(invoice.id);
  expect(original).toHaveLength(1);
  await db.invoice.delete({ where: { id: invoice.id } });
  expect(await history(invoice.id)).toEqual(original);
});

it("keeps revisions with their invoice when the calling connection uses another schema", async () => {
  const invoice = await createInvoice();
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL search_path = public");
    await tx.$executeRawUnsafe(
      `UPDATE "${schema}"."Invoice" SET "totalAmount" = 110 WHERE "id" = $1`,
      invoice.id,
    );
  });
  expect(
    (await history(invoice.id)).map(({ totalAmount }) => totalAmount),
  ).toEqual([100, 110]);
});

it("keeps invoice amendments working for an existing invoice writer", async () => {
  const invoice = await createInvoice();
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE "${writerRole}"`);
    expect(
      await tx.$executeRawUnsafe(
        `UPDATE "${schema}"."Invoice" SET "totalAmount" = 115 WHERE "id" = $1`,
        invoice.id,
      ),
    ).toBe(1);
  });
  expect(
    (await history(invoice.id)).map(({ totalAmount }) => totalAmount),
  ).toEqual([100, 115]);
});

it("does not give an invoice writer direct access to revision records", async () => {
  await expect(
    db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${writerRole}"`);
      await tx.$queryRawUnsafe(`SELECT * FROM "${schema}"."InvoiceRevision"`);
    }),
  ).rejects.toThrow(/permission denied/);
});

it("does not confuse temporary rows with invoice history", async () => {
  const invoice = await createInvoice();
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `CREATE TEMP TABLE "InvoiceRevision" (LIKE "${schema}"."InvoiceRevision" INCLUDING ALL) ON COMMIT DROP`,
    );
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { totalAmount: 125 },
    });
    expect(
      await tx.$queryRawUnsafe(
        'SELECT count(*) AS count FROM pg_temp."InvoiceRevision"',
      ),
    ).toEqual([{ count: 0n }]);
  });
  expect(
    (await history(invoice.id)).map(({ totalAmount }) => totalAmount),
  ).toEqual([100, 125]);
});

it("rebuilds the same past statement after amendment, finalization and cancellation", async () => {
  const parent = await db.parent.create({
    data: {
      firstName: "Synthetic",
      email: `${randomUUID()}@example.test`,
      createdFrom: "pms",
    },
  });
  const invoice = await db.invoice.create({
    data: {
      organisationId: "history-practice",
      parentId: parent.id,
      items: [],
      subtotal: 100,
      totalAmount: 100,
      currency: "GBP",
      status: "AWAITING_PAYMENT",
      finalizedAt: new Date(),
      dueAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    },
  });
  const original = (await history(invoice.id))[0];
  const periodEnd = new Date(original.recordedAt.getTime() + 1);
  await db.$queryRaw`SELECT pg_sleep(0.01)::text`;
  const input = {
    organisationId: "history-practice",
    parentId: parent.id,
    generatedById: "synthetic-staff",
    periodStart: new Date(original.recordedAt.getTime() - 1000),
    periodEnd,
  };
  for (const data of [
    { totalAmount: 150, finalizedAt: null, dueAt: null },
    { finalizedAt: new Date(), dueAt: new Date() },
    { status: "CANCELLED" as const },
  ]) {
    await db.invoice.update({ where: { id: invoice.id }, data });
    const result = await ClientStatementService.generate({
      ...input,
      idempotencyKey: randomUUID(),
    });
    expect(result.snapshot.currencies).toMatchObject([
      {
        currency: "gbp",
        openingBalance: 0,
        closingBalance: 100,
        aging: { days31To60: 100, totalOutstanding: 100 },
        entries: [
          {
            amount: 100,
            direction: "DEBIT",
            occurredAt: original.recordedAt.toISOString(),
          },
        ],
      },
    ]);
    expect(
      await ClientStatementService.getById({
        ...input,
        statementId: result.id,
      }),
    ).toEqual(result);
  }
});

it("keeps stored statement history within the requested practice and client", async () => {
  const parent = await db.parent.create({
    data: {
      firstName: "Synthetic",
      email: `${randomUUID()}@example.test`,
      createdFrom: "pms",
    },
  });
  const invoice = await db.invoice.create({
    data: {
      organisationId: "history-practice",
      parentId: parent.id,
      items: [],
      subtotal: 100,
      totalAmount: 100,
      currency: "GBP",
    },
  });
  const original = (await history(invoice.id))[0];
  await db.invoiceRevision.createMany({
    data: [
      {
        invoiceId: invoice.id,
        organisationId: "other-practice",
        parentId: parent.id,
        totalAmount: 900,
        currency: "GBP",
        status: "PENDING",
        recordedAt: original.recordedAt,
      },
      {
        invoiceId: invoice.id,
        organisationId: "history-practice",
        parentId: "other-client",
        totalAmount: 800,
        currency: "GBP",
        status: "PENDING",
        recordedAt: original.recordedAt,
      },
    ],
  });
  await db.$queryRaw`SELECT pg_sleep(0.01)::text`;
  const result = await ClientStatementService.generate({
    organisationId: "history-practice",
    parentId: parent.id,
    generatedById: "synthetic-staff",
    idempotencyKey: randomUUID(),
    periodStart: new Date(original.recordedAt.getTime() - 1000),
    periodEnd: new Date(original.recordedAt.getTime() + 1),
  });
  expect(result.snapshot.currencies[0]).toMatchObject({
    currency: "gbp",
    closingBalance: 100,
  });
  expect(result.snapshot.currencies[0].entries).toHaveLength(1);
});
