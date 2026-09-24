import {
  SupplierBillService,
  SupplierBillServiceError,
} from "../../src/services/supplier-bills";
import {
  computeBillTotals,
  findUnreceivedStockLine,
} from "../../src/services/supplier-bills/supplier-bill.service";

/**
 * A small in-memory stand-in for the Prisma calls the service makes. The
 * service's rules are about sums across rows (outstanding, balance, ledger),
 * so a per-call mock that returns canned values could not show that posting
 * twice leaves one liability or that a replayed payment allocates nothing.
 * `$transaction` rolls the whole store back when its callback throws, which is
 * what makes the conflict cases observable.
 */
type Row = Record<string, any>;
type Store = Record<
  | "vendors"
  | "accounts"
  | "bills"
  | "lines"
  | "credits"
  | "payments"
  | "allocations"
  | "entries",
  Row[]
>;

let store: Store;
let seq = 0;
let clock = 0;

const emptyStore = (): Store => ({
  vendors: [],
  accounts: [],
  bills: [],
  lines: [],
  credits: [],
  payments: [],
  allocations: [],
  entries: [],
});

const stamp = () => new Date(Date.UTC(2026, 0, 1, 0, 0, clock++));
const newRow = (prefix: string, data: Row): Row => {
  const at = stamp();
  return { id: `${prefix}-${++seq}`, createdAt: at, updatedAt: at, ...data };
};

const matches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) return (cond.in as unknown[]).includes(row[key]);
      if ("gte" in cond || "lte" in cond) {
        return (
          (!cond.gte || row[key] >= cond.gte) &&
          (!cond.lte || row[key] <= cond.lte)
        );
      }
      // compound unique key, e.g. organisationId_vendorId_currency
      return matches(row, cond as Row);
    }
    return row[key] === cond;
  });

const applyData = (row: Row, data: Row) => {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) {
      row[key] += value.increment;
    } else if (value && typeof value === "object" && "decrement" in value) {
      row[key] -= value.decrement;
    } else {
      row[key] = value;
    }
  }
  row.updatedAt = stamp();
};

const withBillRelations = (bill: Row) => ({
  ...bill,
  lines: store.lines.filter((l) => l.billId === bill.id),
  credits: store.credits.filter((c) => c.billId === bill.id),
  allocations: store.allocations.filter((a) => a.billId === bill.id),
  supplierAccount: store.accounts.find((a) => a.id === bill.supplierAccountId),
});

const uniqueViolation = () =>
  Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

jest.mock("src/config/prisma", () => {
  const client: Row = {
    inventoryVendor: {
      findFirst: jest.fn(
        async ({ where }) =>
          store.vendors.find((v) => matches(v, where)) ?? null,
      ),
    },
    supplierAccount: {
      findUnique: jest.fn(
        async ({ where }) =>
          store.accounts.find((a) => matches(a, where)) ?? null,
      ),
      upsert: jest.fn(async ({ where, create }) => {
        const found = store.accounts.find((a) => matches(a, where));
        if (found) return found;
        const row = newRow("acct", { balance: 0, version: 0, ...create });
        store.accounts.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }) => {
        const row = store.accounts.find((a) => a.id === where.id)!;
        applyData(row, data);
        return row;
      }),
    },
    supplierBill: {
      findUnique: jest.fn(async ({ where, include }) => {
        const bill = store.bills.find((b) => matches(b, where));
        if (!bill) return null;
        return include ? withBillRelations(bill) : { ...bill };
      }),
      findMany: jest.fn(async ({ where, take, cursor, skip, include }) => {
        let rows = store.bills
          .filter((b) => matches(b, where))
          .sort(
            (a, b) =>
              b.createdAt - a.createdAt || String(b.id).localeCompare(a.id),
          );
        if (cursor) {
          rows = rows.slice(
            rows.findIndex((b) => b.id === cursor.id) + (skip ?? 0),
          );
        }
        if (take) rows = rows.slice(0, take);
        return rows.map((b) => (include ? withBillRelations(b) : { ...b }));
      }),
      create: jest.fn(async ({ data }) => {
        const { lines, ...rest } = data;
        const bill = newRow("bill", { version: 0, ...rest });
        store.bills.push(bill);
        for (const line of lines.create) {
          store.lines.push(newRow("line", { billId: bill.id, ...line }));
        }
        return bill;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const rows = store.bills.filter((b) => matches(b, where));
        rows.forEach((row) => applyData(row, data));
        return { count: rows.length };
      }),
    },
    supplierCredit: {
      findUnique: jest.fn(
        async ({ where }) =>
          store.credits.find((c) => matches(c, where)) ?? null,
      ),
      create: jest.fn(async ({ data }) => {
        const row = newRow("credit", data);
        store.credits.push(row);
        return row;
      }),
    },
    supplierPayment: {
      findUnique: jest.fn(async ({ where }) => {
        const row = store.payments.find((p) => matches(p, where));
        return row
          ? {
              ...row,
              allocations: store.allocations.filter(
                (a) => a.paymentId === row.id,
              ),
            }
          : null;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }) => {
        const row = store.payments.find((p) => matches(p, where))!;
        return {
          ...row,
          allocations: store.allocations.filter((a) => a.paymentId === row.id),
        };
      }),
      create: jest.fn(async ({ data }) => {
        if (
          store.payments.some(
            (p) =>
              p.organisationId === data.organisationId &&
              p.vendorId === data.vendorId &&
              p.idempotencyKey === data.idempotencyKey,
          )
        ) {
          throw uniqueViolation();
        }
        const row = newRow("payment", data);
        store.payments.push(row);
        return row;
      }),
    },
    supplierAllocation: {
      aggregate: jest.fn(async ({ where }) => ({
        _sum: {
          amount: store.allocations
            .filter((a) => matches(a, where))
            .reduce((sum, a) => sum + a.amount, 0),
        },
      })),
      count: jest.fn(
        async ({ where }) =>
          store.allocations.filter((a) => matches(a, where)).length,
      ),
      create: jest.fn(async ({ data }) => {
        const row = newRow("alloc", data);
        store.allocations.push(row);
        return row;
      }),
    },
    supplierEntry: {
      create: jest.fn(async ({ data }) => {
        const row = newRow("entry", data);
        store.entries.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where }) =>
        store.entries.filter((e) => matches(e, where)),
      ),
    },
  };
  client.$transaction = jest.fn(async (fn: (tx: Row) => Promise<unknown>) => {
    const snapshot = structuredClone(store);
    try {
      return await fn(client);
    } catch (error) {
      store = snapshot;
      throw error;
    }
  });
  return { prisma: client };
});

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const ORG_A = "org-a";
const ORG_B = "org-b";
const VENDOR = "vendor-a";
const VENDOR_B = "vendor-b";

const stockLine = (overrides: Record<string, unknown> = {}) => ({
  lineType: "STOCK" as const,
  description: "Synthetic gauze pack",
  quantityOrdered: 10,
  quantityReceived: 10,
  quantityBilled: 10,
  unitCost: 2,
  ...overrides,
});

const draft = (overrides: Record<string, unknown> = {}) =>
  SupplierBillService.createDraft({
    organisationId: ORG_A,
    vendorId: VENDOR,
    currency: "GBP",
    externalReference: "BILL-1",
    lines: [stockLine()],
    ...overrides,
  });

const post = (billId: string, version = 0, key = "post-1") =>
  SupplierBillService.postBill({
    billId,
    organisationId: ORG_A,
    actorId: "user-1",
    expectedVersion: version,
    idempotencyKey: key,
  });

const pay = (overrides: Record<string, unknown> = {}) =>
  SupplierBillService.createPayment({
    organisationId: ORG_A,
    vendorId: VENDOR,
    currency: "GBP",
    amount: 16,
    paidAt: new Date("2026-02-01T00:00:00.000Z"),
    method: "BANK_TRANSFER",
    reference: "Transfer 1",
    allocations: [],
    idempotencyKey: "pay-1",
    ...overrides,
  });

const account = () => store.accounts.find((a) => a.vendorId === VENDOR)!;

const expectError = async (promise: Promise<unknown>, status: number) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SupplierBillServiceError);
  expect((error as SupplierBillServiceError).statusCode).toBe(status);
  return error as SupplierBillServiceError;
};

beforeEach(() => {
  store = emptyStore();
  seq = 0;
  clock = 0;
  store.vendors.push(
    { id: VENDOR, organisationId: ORG_A },
    { id: VENDOR_B, organisationId: ORG_B },
  );
});

describe("bill totals", () => {
  it("adds tax to the gross payable and keeps net line totals", () => {
    const totals = computeBillTotals([
      { lineTotal: 20, taxAmount: 4 },
      { lineTotal: 5.5, taxAmount: 0 },
    ] as never);
    expect(totals).toEqual({ totalAmount: 29.5, taxTotal: 4 });
  });

  it("treats a stock line with no received quantity as unreceived", () => {
    const lines = [
      {
        lineType: "NON_STOCK_EXPENSE",
        quantityBilled: 3,
        quantityReceived: null,
      },
      { lineType: "STOCK", quantityBilled: 1, quantityReceived: null },
    ];
    expect(findUnreceivedStockLine(lines)).toBe(lines[1]);
    expect(
      findUnreceivedStockLine([
        { lineType: "STOCK", quantityBilled: 5, quantityReceived: 5 },
      ]),
    ).toBeUndefined();
  });
});

describe("SupplierBillService.createDraft", () => {
  it("records a draft with no liability and no ledger entry", async () => {
    const bill = await draft({
      lines: [stockLine({ taxPercent: 20 })],
    });

    expect(bill.status).toBe("DRAFT");
    expect(bill.totalAmount).toBe(24);
    expect(bill.taxTotal).toBe(4);
    expect(bill.lines).toHaveLength(1);
    expect(bill.lines[0]).toMatchObject({ lineTotal: 20, taxAmount: 4 });
    expect(account().balance).toBe(0);
    expect(store.entries).toHaveLength(0);
  });

  it("rejects a supplier that belongs to another organisation", async () => {
    await expectError(draft({ vendorId: VENDOR_B }), 404);
    expect(store.bills).toHaveLength(0);
    expect(store.accounts).toHaveLength(0);
  });

  it("returns the existing draft for a replay with the same key", async () => {
    const first = await draft({ idempotencyKey: "draft-1" });
    const again = await draft({ idempotencyKey: "draft-1" });
    expect(again.id).toBe(first.id);
    expect(store.bills).toHaveLength(1);
  });

  it("refuses a second bill with the same supplier reference", async () => {
    await draft({ idempotencyKey: "draft-1" });
    await expectError(draft({ idempotencyKey: "draft-2" }), 409);
    await expectError(draft(), 409);
  });

  it.each([
    [{ lines: [] }, "At least one bill line is required"],
    [
      { lines: [stockLine({ quantityBilled: 0 })] },
      "Quantity billed must be positive",
    ],
    [
      { lines: [stockLine({ unitCost: -1 })] },
      "Unit cost must be non-negative",
    ],
  ])("validates lines %#", async (overrides, message) => {
    const error = await expectError(draft(overrides), 400);
    expect(error.message).toBe(message);
  });
});

describe("SupplierBillService.postBill", () => {
  it("posts the liability once, and a replay returns the posted bill", async () => {
    const bill = await draft();

    const posted = await post(bill.id);
    expect(posted.status).toBe("POSTED");
    expect(posted.version).toBe(1);
    expect(posted.postedBy).toBe("user-1");
    expect(account().balance).toBe(20);

    const replay = await post(bill.id);
    expect(replay.id).toBe(bill.id);
    expect(account().balance).toBe(20);
    expect(store.entries.filter((e) => e.type === "BILL")).toHaveLength(1);
    expect(store.entries[0]).toMatchObject({ amount: 20, billId: bill.id });
  });

  it("answers a second post under a different key with a conflict", async () => {
    const bill = await draft();
    await post(bill.id);
    await expectError(post(bill.id, 1, "post-2"), 409);
    expect(account().balance).toBe(20);
  });

  it("blocks billing more than was received", async () => {
    const bill = await draft({ lines: [stockLine({ quantityBilled: 11 })] });
    const error = await expectError(post(bill.id), 409);
    expect(error.message).toContain("received quantity");
    expect(account().balance).toBe(0);
  });

  it("allows the difference as a separate non-stock expense line", async () => {
    const bill = await draft({
      lines: [
        stockLine(),
        stockLine({
          lineType: "NON_STOCK_EXPENSE",
          description: "Synthetic delivery charge",
          quantityOrdered: undefined,
          quantityReceived: undefined,
          quantityBilled: 1,
          unitCost: 2,
        }),
      ],
    });
    await post(bill.id);
    expect(account().balance).toBe(22);
  });

  it("refuses a stale expected version and writes nothing", async () => {
    const bill = await draft();
    await expectError(post(bill.id, 3), 409);
    expect(store.bills[0].status).toBe("DRAFT");
    expect(account().balance).toBe(0);
    expect(store.entries).toHaveLength(0);
  });

  it("hides a bill that belongs to another organisation", async () => {
    const bill = await draft();
    await expectError(
      SupplierBillService.postBill({
        billId: bill.id,
        organisationId: ORG_B,
        actorId: "user-2",
        expectedVersion: 0,
        idempotencyKey: "post-1",
      }),
      404,
    );
    await expectError(SupplierBillService.getById(bill.id, ORG_B), 404);
  });
});

describe("credits and payments", () => {
  const postedBill = async () => {
    const bill = await draft();
    return post(bill.id);
  };

  const credit = (billId: string | undefined, amount: number, ref = "CN-1") =>
    SupplierBillService.createCredit({
      organisationId: ORG_A,
      vendorId: VENDOR,
      currency: "GBP",
      externalReference: ref,
      amount,
      billId,
      reason: "Two units returned",
      idempotencyKey: `credit-${ref}`,
    });

  it("runs the receive, bill, credit, pay journey to a zero balance", async () => {
    const bill = await postedBill();

    await credit(bill.id, 4);
    expect(account().balance).toBe(16);

    const payment = await pay({
      allocations: [{ billId: bill.id, amount: 16 }],
    });
    expect(payment.allocations).toHaveLength(1);
    expect(account().balance).toBe(0);

    const replay = await pay({
      allocations: [{ billId: bill.id, amount: 16 }],
    });
    expect(replay.id).toBe(payment.id);
    expect(store.allocations.filter((a) => a.paymentId)).toHaveLength(1);
    expect(account().balance).toBe(0);

    const statement = await SupplierBillService.getSupplierAccountStatement({
      organisationId: ORG_A,
      vendorId: VENDOR,
      currency: "GBP",
    });
    expect(statement.entries.map((e) => [e.type, e.amount])).toEqual([
      ["BILL", 20],
      ["CREDIT", -4],
      ["PAYMENT", -16],
    ]);
  });

  it("refuses to allocate more than is outstanding on a bill", async () => {
    const bill = await postedBill();
    await credit(bill.id, 4);

    const error = await expectError(
      pay({ amount: 20, allocations: [{ billId: bill.id, amount: 20 }] }),
      409,
    );
    expect(error.message).toContain("outstanding");
    expect(store.payments).toHaveLength(0);
    expect(account().balance).toBe(16);
  });

  it("refuses a credit larger than what is outstanding on its bill", async () => {
    const bill = await postedBill();
    await expectError(credit(bill.id, 21), 409);
    expect(store.credits).toHaveLength(0);
    expect(account().balance).toBe(20);
  });

  it("keeps an unallocated part of a payment as supplier credit", async () => {
    const bill = await postedBill();
    await pay({ amount: 25, allocations: [{ billId: bill.id, amount: 20 }] });
    expect(account().balance).toBe(-5);
  });

  it("recovers a payment that lost a race to its own retry", async () => {
    const bill = await postedBill();
    const winner = { id: "payment-winner", allocations: [] };
    const { prisma } = jest.requireMock("src/config/prisma");
    prisma.supplierPayment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    prisma.supplierPayment.create.mockRejectedValueOnce(uniqueViolation());

    const result = await pay({
      allocations: [{ billId: bill.id, amount: 16 }],
    });
    expect(result).toBe(winner);
    expect(account().balance).toBe(20);
  });

  it("rolls a payment back when its bill changed underneath it", async () => {
    const bill = await postedBill();
    const { prisma } = jest.requireMock("src/config/prisma");
    prisma.supplierBill.updateMany.mockResolvedValueOnce({ count: 0 });

    const error = await expectError(
      pay({ allocations: [{ billId: bill.id, amount: 16 }] }),
      409,
    );
    expect(error.message).toContain("changed while allocating");
    expect(store.payments).toHaveLength(0);
    expect(account().balance).toBe(20);
  });

  it("rethrows a failure that is not a lost race", async () => {
    const bill = await postedBill();
    const { prisma } = jest.requireMock("src/config/prisma");
    prisma.supplierPayment.create.mockRejectedValueOnce(new Error("db down"));

    await expect(
      pay({ allocations: [{ billId: bill.id, amount: 16 }] }),
    ).rejects.toThrow("db down");
  });

  it.each([
    [{ amount: 0 }, "Payment amount must be positive"],
    [{ allocations: [] }, "At least one allocation is required"],
    [
      {
        allocations: [
          { billId: "b", amount: 1 },
          { billId: "b", amount: 1 },
        ],
      },
      "Each bill may appear only once in a payment",
    ],
    [
      { amount: 5, allocations: [{ billId: "b", amount: 6 }] },
      "Total allocated amount exceeds payment amount",
    ],
  ])("validates the payment %#", async (overrides, message) => {
    const error = await expectError(pay(overrides), 400);
    expect(error.message).toBe(message);
  });

  it("refuses to allocate to a draft, another currency or another supplier", async () => {
    const draftBill = await draft({ externalReference: "BILL-D" });
    const error = await expectError(
      pay({ allocations: [{ billId: draftBill.id, amount: 1 }] }),
      409,
    );
    expect(error.message).toContain("not posted");

    const posted = await postedBill();
    await expectError(
      pay({ currency: "EUR", allocations: [{ billId: posted.id, amount: 1 }] }),
      404,
    );
    await expectError(
      pay({
        vendorId: VENDOR_B,
        allocations: [{ billId: posted.id, amount: 1 }],
      }),
      404,
    );
  });

  it("validates what a credit may reference", async () => {
    const draftBill = await draft({ externalReference: "BILL-D" });
    await expectError(credit(draftBill.id, 1), 409);
    await expectError(credit("missing", 1), 404);
    await expectError(credit(undefined, 0), 400);
    await expectError(
      SupplierBillService.createCredit({
        organisationId: ORG_A,
        vendorId: VENDOR,
        currency: "GBP",
        externalReference: "CN-X",
        amount: 1,
        billId: draftBill.id,
        receiptId: "receipt-1",
      }),
      400,
    );
  });

  it("returns an existing credit for a replay and refuses a reused reference", async () => {
    const first = await credit(undefined, 3);
    const again = await credit(undefined, 3);
    expect(again.id).toBe(first.id);
    await expectError(
      SupplierBillService.createCredit({
        organisationId: ORG_A,
        vendorId: VENDOR,
        currency: "GBP",
        externalReference: "CN-1",
        amount: 3,
      }),
      409,
    );
    expect(account().balance).toBe(-3);
  });
});

describe("SupplierBillService.voidBill", () => {
  const voidIt = (billId: string, version: number) =>
    SupplierBillService.voidBill({
      billId,
      organisationId: ORG_A,
      actorId: "user-1",
      reason: "Entered twice",
      expectedVersion: version,
    });

  it("reverses a posted bill with nothing allocated", async () => {
    const bill = await draft();
    await post(bill.id);
    const voided = await voidIt(bill.id, 1);

    expect(voided.status).toBe("VOID");
    expect(account().balance).toBe(0);
    expect(store.entries.map((e) => [e.type, e.amount])).toEqual([
      ["BILL", 20],
      ["REVERSAL", -20],
    ]);
  });

  it("refuses to void a bill that money has been allocated to", async () => {
    const bill = await draft();
    await post(bill.id);
    await pay({ amount: 5, allocations: [{ billId: bill.id, amount: 5 }] });

    const current = store.bills[0].version;
    await expectError(voidIt(bill.id, current), 409);
    expect(store.bills[0].status).toBe("POSTED");
    expect(account().balance).toBe(15);
  });

  it("refuses a draft and a stale version", async () => {
    const bill = await draft();
    await expectError(voidIt(bill.id, 0), 409);
    await post(bill.id);
    await expectError(voidIt(bill.id, 0), 409);
    expect(store.bills[0].status).toBe("POSTED");
  });
});

describe("reads", () => {
  it("pages bills newest first with a stable cursor", async () => {
    for (const ref of ["R1", "R2", "R3"]) {
      await draft({ externalReference: ref });
    }

    const first = await SupplierBillService.list({
      organisationId: ORG_A,
      limit: 2,
    });
    expect(first.bills.map((b) => b.externalReference)).toEqual(["R3", "R2"]);
    expect(first.nextCursor).toBe(first.bills[1].id);

    const second = await SupplierBillService.list({
      organisationId: ORG_A,
      vendorId: VENDOR,
      status: "DRAFT",
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(second.bills.map((b) => b.externalReference)).toEqual(["R1"]);
    expect(second.nextCursor).toBeUndefined();
  });

  it("filters a statement by date and 404s an unknown account", async () => {
    const bill = await draft();
    await post(bill.id);
    const postedAt = store.entries[0].createdAt as Date;

    const before = await SupplierBillService.getSupplierAccountStatement({
      organisationId: ORG_A,
      vendorId: VENDOR,
      currency: "GBP",
      toDate: new Date(postedAt.getTime() - 1),
    });
    expect(before.entries).toHaveLength(0);

    const during = await SupplierBillService.getSupplierAccountStatement({
      organisationId: ORG_A,
      vendorId: VENDOR,
      currency: "GBP",
      fromDate: postedAt,
      toDate: postedAt,
    });
    expect(during.entries).toHaveLength(1);

    await expectError(
      SupplierBillService.getSupplierAccount(ORG_A, VENDOR, "EUR"),
      404,
    );
  });
});
