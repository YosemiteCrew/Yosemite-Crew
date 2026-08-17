import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  coerceDateFields,
  createClinicalHandlers,
  dateRange,
  orgParams,
  patientScopeQuery,
  uuid,
} from "../../../../src/controllers/web/shared/clinical-controller.helpers";

class SampleError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "SampleError";
  }
}

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const RECORD_ID = "22222222-2222-4222-8222-222222222222";

const buildRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as never;
  res.json = jest.fn().mockReturnValue(res) as never;
  res.send = jest.fn().mockReturnValue(res) as never;
  return res as Response & {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
  };
};

const buildReq = (overrides: Partial<Request> & { userId?: string } = {}) =>
  ({
    params: {},
    body: {},
    query: {},
    ...overrides,
  }) as unknown as Request;

const RecordParamsSchema = orgParams.extend({ recordId: uuid() });
const BodySchema = z.object({ label: z.string().min(1) });
const QuerySchema = z.object({ label: z.string().min(1).optional() });

const { handleError, handler } = createClinicalHandlers(SampleError);

describe("createClinicalHandlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleError", () => {
    it("uses the service error status code and message", () => {
      const res = buildRes();

      handleError(new SampleError("Record not found.", 404), res, "fallback");

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Record not found." });
    });

    it("returns 500 with the fallback for unknown errors", () => {
      const res = buildRes();

      handleError(new Error("boom"), res, "Failed to do the thing");

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to do the thing",
      });
    });

    it("returns 500 with the fallback for non-Error values", () => {
      const res = buildRes();

      handleError("oops", res, "Failed to do the thing");

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to do the thing",
      });
    });
  });

  describe("route parameter validation", () => {
    it("rejects invalid route parameters before touching the payload", async () => {
      const run = jest.fn();
      const route = handler({
        params: RecordParamsSchema,
        body: BodySchema,
        fallback: "Failed to update record",
        run: run as never,
      });
      const res = buildRes();

      await route(
        buildReq({ params: { organisationId: "not-a-uuid" }, body: {} }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid route parameters",
      });
      expect(run).not.toHaveBeenCalled();
    });
  });

  describe("payload validation", () => {
    it("rejects an invalid body with the zod error message", async () => {
      const run = jest.fn();
      const route = handler({
        params: orgParams,
        body: BodySchema,
        fallback: "Failed to create record",
        run: run as never,
      });
      const res = buildRes();
      const expected = BodySchema.safeParse({});

      await route(
        buildReq({ params: { organisationId: ORG_ID }, body: {} }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: expected.success ? "" : expected.error.message,
      });
      expect(run).not.toHaveBeenCalled();
    });

    it("rejects an invalid query with the zod error message", async () => {
      const route = handler({
        params: orgParams,
        query: QuerySchema,
        fallback: "Failed to list records",
        run: () => [],
      });
      const res = buildRes();

      await route(
        buildReq({
          params: { organisationId: ORG_ID },
          query: { label: ["a", "b"] },
        }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining("label") as unknown as string,
      });
    });

    it("uses invalidInputMessage when provided", async () => {
      const route = handler({
        params: orgParams,
        query: QuerySchema,
        invalidInputMessage: "Invalid query parameters",
        fallback: "Failed to list records",
        run: () => [],
      });
      const res = buildRes();

      await route(
        buildReq({
          params: { organisationId: ORG_ID },
          query: { label: ["a", "b"] },
        }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid query parameters",
      });
    });
  });

  describe("success responses", () => {
    it("defaults to 200 and passes parsed params to run", async () => {
      const run = jest.fn().mockReturnValue({ id: RECORD_ID });
      const route = handler({
        params: RecordParamsSchema,
        fallback: "Failed to get record",
        run: run as never,
      });
      const res = buildRes();

      await route(
        buildReq({
          params: { organisationId: ORG_ID, recordId: RECORD_ID },
        }),
        res,
      );

      expect(run).toHaveBeenCalledWith({
        params: { organisationId: ORG_ID, recordId: RECORD_ID },
        userId: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: RECORD_ID });
    });

    it("returns 201 with the awaited run result and the parsed body", async () => {
      const run = jest.fn().mockResolvedValue({ id: RECORD_ID } as never);
      const route = handler({
        params: orgParams,
        body: BodySchema,
        status: 201,
        fallback: "Failed to create record",
        run: run as never,
      });
      const res = buildRes();

      await route(
        buildReq({
          params: { organisationId: ORG_ID },
          body: { label: "hello", extra: "dropped" },
          userId: "user-1",
        }),
        res,
      );

      expect(run).toHaveBeenCalledWith({
        params: { organisationId: ORG_ID },
        input: { label: "hello" },
        userId: "user-1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: RECORD_ID });
    });

    it("reads the payload from the query string for a query config", async () => {
      const run = jest.fn().mockReturnValue([]);
      const route = handler({
        params: orgParams,
        query: QuerySchema,
        fallback: "Failed to list records",
        run: run as never,
      });
      const res = buildRes();

      await route(
        buildReq({
          params: { organisationId: ORG_ID },
          query: { label: "needle" },
        }),
        res,
      );

      expect(run).toHaveBeenCalledWith({
        params: { organisationId: ORG_ID },
        input: { label: "needle" },
        userId: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("sends an empty 204 body without a JSON content type", async () => {
      const run = jest.fn().mockResolvedValue(undefined as never);
      const route = handler({
        params: RecordParamsSchema,
        status: 204,
        fallback: "Failed to delete record",
        run: run as never,
      });
      const res = buildRes();

      await route(
        buildReq({ params: { organisationId: ORG_ID, recordId: RECORD_ID } }),
        res,
      );

      expect(run).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledWith();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("actor resolution", () => {
    it("passes undefined when the request carries no user id", async () => {
      const run = jest.fn().mockReturnValue({});
      const route = handler({
        params: orgParams,
        fallback: "Failed to get record",
        run: run as never,
      });
      const res = buildRes();

      await route(buildReq({ params: { organisationId: ORG_ID } }), res);

      expect(run).toHaveBeenCalledWith({
        params: { organisationId: ORG_ID },
        userId: undefined,
      });
    });

    it("normalises a null user id to undefined", async () => {
      const run = jest.fn().mockReturnValue({});
      const route = handler({
        params: orgParams,
        fallback: "Failed to get record",
        run: run as never,
      });
      const res = buildRes();
      const req = buildReq({ params: { organisationId: ORG_ID } });
      (req as unknown as { userId: string | null }).userId = null;

      await route(req, res);

      expect(run).toHaveBeenCalledWith({
        params: { organisationId: ORG_ID },
        userId: undefined,
      });
    });
  });

  describe("error propagation from run", () => {
    it("maps a service error thrown by run to its status code", async () => {
      const route = handler({
        params: RecordParamsSchema,
        fallback: "Failed to get record",
        run: () => {
          throw new SampleError("Record not found.", 404);
        },
      });
      const res = buildRes();

      await route(
        buildReq({ params: { organisationId: ORG_ID, recordId: RECORD_ID } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Record not found." });
    });

    it("maps a rejected promise from run to 500 with the fallback", async () => {
      const route = handler({
        params: RecordParamsSchema,
        fallback: "Failed to get record",
        run: () => Promise.reject(new Error("db down")),
      });
      const res = buildRes();

      await route(
        buildReq({ params: { organisationId: ORG_ID, recordId: RECORD_ID } }),
        res,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Failed to get record",
      });
    });
  });
});

describe("orgParams and uuid", () => {
  it("accepts a uuid organisation id and rejects anything else", () => {
    expect(orgParams.safeParse({ organisationId: ORG_ID }).success).toBe(true);
    expect(orgParams.safeParse({ organisationId: "nope" }).success).toBe(false);
  });

  it("extends into a per-entity params schema", () => {
    const schema = orgParams.extend({ recordId: uuid() });

    expect(
      schema.safeParse({ organisationId: ORG_ID, recordId: RECORD_ID }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ organisationId: ORG_ID, recordId: "nope" }).success,
    ).toBe(false);
  });
});

describe("patientScopeQuery", () => {
  it("accepts the optional patient and encounter filters", () => {
    expect(patientScopeQuery.safeParse({}).success).toBe(true);
    expect(
      patientScopeQuery.safeParse({
        patientId: RECORD_ID,
        encounterId: ORG_ID,
      }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid patient id", () => {
    expect(patientScopeQuery.safeParse({ patientId: "nope" }).success).toBe(
      false,
    );
  });
});

describe("dateRange", () => {
  it("omits bounds that were not supplied", () => {
    expect(dateRange(undefined, undefined)).toEqual({});
    expect(dateRange("2026-01-01T00:00:00.000Z", undefined)).toEqual({
      from: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(dateRange(undefined, "2026-02-01T00:00:00.000Z")).toEqual({
      to: new Date("2026-02-01T00:00:00.000Z"),
    });
  });

  it("converts both bounds when supplied", () => {
    expect(
      dateRange("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z"),
    ).toEqual({
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-02-01T00:00:00.000Z"),
    });
  });
});

describe("coerceDateFields", () => {
  it("converts the listed string keys to dates and leaves the rest alone", () => {
    const result = coerceDateFields(
      {
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: undefined,
        count: 3,
        label: "unchanged",
      },
      ["startDate", "endDate", "missing"],
    );

    expect(result.startDate).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(result.endDate).toBeUndefined();
    expect(result.count).toBe(3);
    expect(result.label).toBe("unchanged");
    expect("missing" in result).toBe(false);
  });

  it("does not mutate the source object", () => {
    const source = { startDate: "2026-01-01T00:00:00.000Z" };

    coerceDateFields(source, ["startDate"]);

    expect(source.startDate).toBe("2026-01-01T00:00:00.000Z");
  });
});
