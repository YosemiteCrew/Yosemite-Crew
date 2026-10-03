import {
  PaymentProvider,
  PrismaClient,
  ProviderReceiptStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { ProviderReceiptService } from "src/services/finance/provider-receipt";

jest.mock("src/config/prisma", () => ({
  get prisma() {
    return mockReceiptDb;
  },
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
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
const schema = `receipt_refunds_${randomUUID().replaceAll("-", "")}`;
connection.searchParams.set("schema", schema);
const admin = new PrismaClient();
const db = new PrismaClient({
  datasources: { db: { url: connection.toString() } },
});
const mockReceiptDb = db;
const firstDate = new Date("2026-09-18T10:00:00.000Z");
const laterDate = new Date("2026-09-20T10:00:00.000Z");

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  for (const [type, values] of [
    ["PaymentProvider", Object.values(PaymentProvider)],
    ["ProviderReceiptStatus", Object.values(ProviderReceiptStatus)],
  ] as const) {
    const labels = values.map((value) => `'${value}'`).join(", ");
    await admin.$executeRawUnsafe(
      `CREATE TYPE "${schema}"."${type}" AS ENUM (${labels})`,
    );
  }
  await admin.$executeRawUnsafe(
    `CREATE TABLE "${schema}"."ProviderReceipt" (LIKE "public"."ProviderReceipt" INCLUDING ALL)`,
  );
  for (const [column, type] of [
    ["provider", "PaymentProvider"],
    ["status", "ProviderReceiptStatus"],
  ]) {
    await admin.$executeRawUnsafe(
      `ALTER TABLE "${schema}"."ProviderReceipt" ALTER COLUMN "${column}" DROP DEFAULT`,
    );
    await admin.$executeRawUnsafe(
      `ALTER TABLE "${schema}"."ProviderReceipt" ALTER COLUMN "${column}" TYPE "${schema}"."${type}" USING "${column}"::text::"${schema}"."${type}"`,
    );
  }
  await admin.$executeRawUnsafe(
    `ALTER TABLE "${schema}"."ProviderReceipt" ALTER COLUMN "status" SET DEFAULT 'UNATTRIBUTED'`,
  );
  const root = resolve(__dirname, "../../..");
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
      input: readFileSync(
        resolve(
          root,
          "packages/database/prisma/migrations/20261003210000_receipt_refund_history/migration.sql",
        ),
        "utf8",
      ),
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: connection.toString(),
        DIRECT_URL: connection.toString(),
      },
    },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}, 30_000);

afterAll(async () => {
  await db.$disconnect();
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await admin.$disconnect();
  }
});

const createReceipt = () =>
  db.providerReceipt.create({
    data: {
      provider: "STRIPE",
      merchantAccountRef: randomUUID(),
      paymentRef: randomUUID(),
      amount: 100,
      currency: "gbp",
      capturedAt: new Date("2026-09-17T10:00:00.000Z"),
    },
  });

const refund = (
  receipt: Awaited<ReturnType<typeof createReceipt>>,
  amount: number,
  id: string,
  occurredAt: Date,
) =>
  ProviderReceiptService.recordRefund({
    provider: receipt.provider,
    merchantAccountRef: receipt.merchantAccountRef,
    paymentRef: receipt.paymentRef,
    currency: receipt.currency,
    refundedAmount: amount,
    notification: { id, occurredAt },
  });

const history = (receiptId: string) =>
  db.providerReceiptRefund.findMany({
    where: { receiptId },
    orderBy: { occurredAt: "asc" },
  });

it("preserves successive dated partial refund totals", async () => {
  const receipt = await createReceipt();
  expect(await refund(receipt, 20, "first", firstDate)).toMatchObject({
    applied: true,
  });
  expect(await refund(receipt, 70, "later", laterDate)).toMatchObject({
    applied: true,
  });
  expect(await history(receipt.id)).toMatchObject([
    { cumulativeAmount: 20, currency: "gbp", occurredAt: firstDate },
    { cumulativeAmount: 70, currency: "gbp", occurredAt: laterDate },
  ]);
  expect(
    await db.providerReceipt.findUnique({ where: { id: receipt.id } }),
  ).toMatchObject({ refundedAmount: 70 });
});

it("retains an earlier notification delivered after a later total", async () => {
  const receipt = await createReceipt();
  await refund(receipt, 70, "later", laterDate);
  expect(await refund(receipt, 20, "first", firstDate)).toMatchObject({
    applied: false,
    refundedAmount: 70,
  });
  expect(await history(receipt.id)).toMatchObject([
    { providerEventId: "first", cumulativeAmount: 20, occurredAt: firstDate },
    { providerEventId: "later", cumulativeAmount: 70, occurredAt: laterDate },
  ]);
});

it("records concurrent repeated notifications only once", async () => {
  const receipt = await createReceipt();
  const results = await Promise.all([
    refund(receipt, 20, "same", firstDate),
    refund(receipt, 20, "same", firstDate),
  ]);
  expect(results).not.toContain(null);
  expect(results.filter((result) => result?.applied)).toHaveLength(1);
  expect(await history(receipt.id)).toHaveLength(1);
  expect(
    await db.providerReceipt.findUnique({ where: { id: receipt.id } }),
  ).toMatchObject({ refundedAmount: 20, version: 1 });
});

it("does not replace the amount attached to an earlier event", async () => {
  const receipt = await createReceipt();
  await refund(receipt, 20, "same", firstDate);
  expect(await refund(receipt, 70, "same", firstDate)).toBeNull();
  expect(await history(receipt.id)).toMatchObject([{ cumulativeAmount: 20 }]);
  expect(
    await db.providerReceipt.findUnique({ where: { id: receipt.id } }),
  ).toMatchObject({ refundedAmount: 20, version: 1 });
});

it("rolls back dated history when the receipt update fails", async () => {
  const receipt = await createReceipt();
  const constraint = `receipt_failure_${randomUUID().replaceAll("-", "")}`;
  await admin.$executeRawUnsafe(
    `ALTER TABLE "${schema}"."ProviderReceipt" ADD CONSTRAINT "${constraint}" CHECK ("id" <> '${receipt.id}' OR "refundedAmount" = 0)`,
  );
  expect(await refund(receipt, 20, "first", firstDate)).toBeNull();
  expect(await history(receipt.id)).toEqual([]);
  expect(
    await db.providerReceipt.findUnique({ where: { id: receipt.id } }),
  ).toMatchObject({ refundedAmount: 0, version: 0 });
});

it("keeps the receipt unchanged when dated history cannot be written", async () => {
  const receipt = await createReceipt();
  const constraint = `history_failure_${randomUUID().replaceAll("-", "")}`;
  await admin.$executeRawUnsafe(
    `ALTER TABLE "${schema}"."ProviderReceiptRefund" ADD CONSTRAINT "${constraint}" CHECK ("receiptId" <> '${receipt.id}')`,
  );
  expect(await refund(receipt, 20, "first", firstDate)).toBeNull();
  expect(await history(receipt.id)).toEqual([]);
  expect(
    await db.providerReceipt.findUnique({ where: { id: receipt.id } }),
  ).toMatchObject({ refundedAmount: 0, version: 0 });
});

it("keeps equal event references separate for different receipts", async () => {
  const first = await createReceipt();
  const second = await createReceipt();
  await refund(first, 20, "same", firstDate);
  await refund(second, 50, "same", laterDate);
  expect(await history(first.id)).toMatchObject([
    { cumulativeAmount: 20, occurredAt: firstDate },
  ]);
  expect(await history(second.id)).toMatchObject([
    { cumulativeAmount: 50, occurredAt: laterDate },
  ]);
});

it("retains dated refund history when its receipt is removed", async () => {
  const receipt = await createReceipt();
  await refund(receipt, 20, "first", firstDate);
  await db.providerReceipt.delete({ where: { id: receipt.id } });
  expect(await history(receipt.id)).toMatchObject([
    { cumulativeAmount: 20, occurredAt: firstDate },
  ]);
});
