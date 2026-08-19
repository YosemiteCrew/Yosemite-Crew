import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { InventoryCountController } from "../../../src/controllers/web/inventory-count.controller";
import {
  InventoryCountService,
  InventoryCountError,
} from "../../../src/services/inventory-count.service";

jest.mock("../../../src/services/inventory-count.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/inventory-count.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    InventoryCountService: {
      record: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      reconcile: jest.fn(),
      unreconciled: jest.fn(),
    },
  };
});

const service = jest.mocked(InventoryCountService);

const buildResponse = () => {
  const json = jest.fn();
  const send = jest.fn();
  const status = jest.fn(() => ({ json, send }));
  return { json, send, status } as unknown as Response & {
    json: jest.Mock;
    send: jest.Mock;
    status: jest.Mock;
  };
};

const ORG = "org-1";
const COUNT_ID = "count-1";

const buildRequest = (
  overrides: Partial<{
    params: Record<string, string>;
    query: Record<string, unknown>;
    body: unknown;
  }> = {},
): Request =>
  ({
    params: { organisationId: ORG, ...(overrides.params ?? {}) },
    query: overrides.query ?? {},
    body: overrides.body ?? {},
  }) as unknown as Request;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("InventoryCountController.record", () => {
  it("coerces countedAt and answers 201 with the stored count", async () => {
    const stored = { id: COUNT_ID, discrepancy: -3 };
    service.record.mockResolvedValue(stored as never);
    const res = buildResponse();

    await InventoryCountController.record(
      buildRequest({
        body: {
          inventoryItemId: "item-1",
          countedBy: "user-1",
          countedAt: "2026-03-01T09:00:00.000Z",
          systemCount: 40,
          physicalCount: 37,
          notes: "Three vials missing",
        },
      }),
      res,
    );

    expect(service.record).toHaveBeenCalledWith({
      organisationId: ORG,
      inventoryItemId: "item-1",
      countedBy: "user-1",
      countedAt: new Date("2026-03-01T09:00:00.000Z"),
      systemCount: 40,
      physicalCount: 37,
      notes: "Three vials missing",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects a negative physical count with 400 and never calls the service", async () => {
    const res = buildResponse();

    await InventoryCountController.record(
      buildRequest({
        body: {
          inventoryItemId: "item-1",
          countedAt: "2026-03-01T09:00:00.000Z",
          systemCount: 40,
          physicalCount: -1,
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Object) });
    expect(service.record).not.toHaveBeenCalled();
  });

  it("maps a service error onto its own status", async () => {
    service.record.mockRejectedValue(
      new InventoryCountError("Item not found.", 404) as never,
    );
    const res = buildResponse();

    await InventoryCountController.record(
      buildRequest({
        body: {
          inventoryItemId: "item-1",
          countedAt: "2026-03-01T09:00:00.000Z",
          systemCount: 40,
          physicalCount: 40,
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Item not found." });
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.record.mockRejectedValue(new Error("connection reset") as never);
    const res = buildResponse();

    await InventoryCountController.record(
      buildRequest({
        body: {
          inventoryItemId: "item-1",
          countedAt: "2026-03-01T09:00:00.000Z",
          systemCount: 40,
          physicalCount: 40,
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error." });
  });
});

describe("InventoryCountController.get", () => {
  it("returns the count scoped to the organisation", async () => {
    const stored = { id: COUNT_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await InventoryCountController.get(
      buildRequest({ params: { countId: COUNT_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(COUNT_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a 404 from the service straight through", async () => {
    service.get.mockRejectedValue(
      new InventoryCountError(
        "Inventory count record not found.",
        404,
      ) as never,
    );
    const res = buildResponse();

    await InventoryCountController.get(
      buildRequest({ params: { countId: COUNT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Inventory count record not found.",
    });
  });
});

describe("InventoryCountController.list", () => {
  it("parses the boolean flag and both date bounds", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await InventoryCountController.list(
      buildRequest({
        query: {
          inventoryItemId: "item-1",
          reconciled: "false",
          fromDate: "2026-02-01T00:00:00.000Z",
          toDate: "2026-03-01T00:00:00.000Z",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      inventoryItemId: "item-1",
      reconciled: false,
      fromDate: new Date("2026-02-01T00:00:00.000Z"),
      toDate: new Date("2026-03-01T00:00:00.000Z"),
    });
  });

  it("leaves every optional filter undefined when the query is empty", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await InventoryCountController.list(buildRequest(), res);

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      inventoryItemId: undefined,
      reconciled: undefined,
      fromDate: undefined,
      toDate: undefined,
    });
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.list.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await InventoryCountController.list(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error." });
  });
});

describe("InventoryCountController.reconcile", () => {
  it("forwards the reconciling user and notes", async () => {
    const stored = { id: COUNT_ID, reconciled: true };
    service.reconcile.mockResolvedValue(stored as never);
    const res = buildResponse();

    await InventoryCountController.reconcile(
      buildRequest({
        params: { countId: COUNT_ID },
        body: { reconciledBy: "user-2", notes: "Write-off raised" },
      }),
      res,
    );

    expect(service.reconcile).toHaveBeenCalledWith(
      COUNT_ID,
      ORG,
      "user-2",
      "Write-off raised",
    );
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("requires a reconciling user", async () => {
    const res = buildResponse();

    await InventoryCountController.reconcile(
      buildRequest({ params: { countId: COUNT_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.reconcile).not.toHaveBeenCalled();
  });

  it("passes the already-reconciled conflict through", async () => {
    service.reconcile.mockRejectedValue(
      new InventoryCountError(
        "Inventory count is already reconciled.",
        409,
      ) as never,
    );
    const res = buildResponse();

    await InventoryCountController.reconcile(
      buildRequest({
        params: { countId: COUNT_ID },
        body: { reconciledBy: "user-2" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "Inventory count is already reconciled.",
    });
  });
});

describe("InventoryCountController.unreconciled", () => {
  it("returns the outstanding counts for the organisation", async () => {
    const counts = [{ id: COUNT_ID }];
    service.unreconciled.mockResolvedValue(counts as never);
    const res = buildResponse();

    await InventoryCountController.unreconciled(buildRequest(), res);

    expect(service.unreconciled).toHaveBeenCalledWith(ORG);
    expect(res.json).toHaveBeenCalledWith(counts);
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.unreconciled.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await InventoryCountController.unreconciled(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error." });
  });
});
