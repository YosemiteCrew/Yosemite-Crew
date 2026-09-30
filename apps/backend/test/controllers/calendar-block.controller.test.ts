import { CalendarBlockController } from "../../src/controllers/web/calendar-block.controller";
import {
  CalendarBlockError,
  CalendarBlockService,
} from "../../src/services/calendar-block.service";
import type { Request, Response } from "express";

jest.mock("../../src/services/calendar-block.service", () => ({
  CalendarBlockError: class CalendarBlockError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  },
  CalendarBlockService: {
    create: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
  },
}));

const service = CalendarBlockService as jest.Mocked<
  typeof CalendarBlockService
>;
const makeResponse = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res;
};
const request = (
  params: Record<string, string>,
  body?: unknown,
  query?: unknown,
  userId?: string,
) => ({ params, body, query, userId }) as unknown as Request;
const startAt = "2027-01-06T11:00:00.000Z";
const endAt = "2027-01-06T12:00:00.000Z";
const validInput = {
  targetType: "STAFF",
  targetId: "staff-1",
  startAt,
  endAt,
  reason: "Lunch",
};

beforeEach(() => jest.clearAllMocks());

describe("CalendarBlockController", () => {
  it("validates and lists an organization date range", async () => {
    const res = makeResponse();
    await CalendarBlockController.list(
      request({ organisationId: "org-1" }, undefined, {}),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    service.list.mockResolvedValueOnce([] as never);
    await CalendarBlockController.list(
      request({ organisationId: "org-1" }, undefined, {
        from: startAt,
        to: endAt,
      }),
      res as unknown as Response,
    );
    expect(service.list).toHaveBeenCalledWith(
      "org-1",
      new Date(startAt),
      new Date(endAt),
    );
    expect(res.json).toHaveBeenCalledWith([]);
    service.list.mockRejectedValueOnce(new Error("unexpected"));
    await CalendarBlockController.list(
      request({ organisationId: "org-1" }, undefined, {
        from: startAt,
        to: endAt,
      }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("creates a block, attributes it to the session, and maps errors", async () => {
    const res = makeResponse();
    await CalendarBlockController.create(
      request({ organisationId: "org-1" }, {}),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    service.create.mockResolvedValueOnce({ id: "block-1" } as never);
    await CalendarBlockController.create(
      request({ organisationId: "org-1" }, validInput, undefined, "user-1"),
      res as unknown as Response,
    );
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        createdBy: "user-1",
        startAt: new Date(startAt),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    service.create.mockRejectedValueOnce(
      new CalendarBlockError("Missing resource.", 404),
    );
    await CalendarBlockController.create(
      request({ organisationId: "org-1" }, validInput),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    service.create.mockRejectedValueOnce(new Error("unexpected"));
    await CalendarBlockController.create(
      request({ organisationId: "org-1" }, validInput),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("updates and deletes a block with scoped identifiers", async () => {
    const res = makeResponse();
    await CalendarBlockController.update(
      request({ organisationId: "org-1", blockId: "block-1" }, {}),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    service.update.mockResolvedValueOnce({ id: "block-1" } as never);
    await CalendarBlockController.update(
      request(
        { organisationId: "org-1", blockId: "block-1" },
        { reason: "Training" },
      ),
      res as unknown as Response,
    );
    expect(service.update).toHaveBeenCalledWith("org-1", "block-1", {
      reason: "Training",
    });
    service.update.mockRejectedValueOnce(
      new CalendarBlockError("Not found.", 404),
    );
    await CalendarBlockController.update(
      request(
        { organisationId: "org-1", blockId: "missing" },
        { reason: "Training" },
      ),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(404);

    await CalendarBlockController.delete(
      request({ organisationId: "org-1", blockId: "block-1" }),
      res as unknown as Response,
    );
    expect(service.delete).toHaveBeenCalledWith("org-1", "block-1");
    expect(res.status).toHaveBeenCalledWith(204);
    service.delete.mockRejectedValueOnce(new Error("unexpected"));
    await CalendarBlockController.delete(
      request({ organisationId: "org-1", blockId: "block-1" }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
