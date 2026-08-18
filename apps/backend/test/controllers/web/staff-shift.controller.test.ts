import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { StaffShiftController } from "../../../src/controllers/web/staff-shift.controller";
import {
  StaffShiftService,
  StaffShiftError,
} from "../../../src/services/staff-shift.service";

jest.mock("../../../src/services/staff-shift.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/staff-shift.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    StaffShiftService: {
      schedule: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      start: jest.fn(),
      complete: jest.fn(),
      cancel: jest.fn(),
      markNoShow: jest.fn(),
    },
  };
});

const service = jest.mocked(StaffShiftService);

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
const SHIFT_ID = "shift-1";

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

const validShift = {
  staffId: "staff-1",
  role: "VET_NURSE",
  shiftDate: "2026-04-01T00:00:00.000Z",
  startTime: "2026-04-01T08:00:00.000Z",
  endTime: "2026-04-01T17:00:00.000Z",
  breakMinutes: 30,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("StaffShiftController.create", () => {
  it("coerces all three timestamps and answers 201", async () => {
    const stored = { id: SHIFT_ID, status: "SCHEDULED" };
    service.schedule.mockResolvedValue(stored as never);
    const res = buildResponse();

    await StaffShiftController.create(buildRequest({ body: validShift }), res);

    expect(service.schedule).toHaveBeenCalledWith({
      organisationId: ORG,
      staffId: "staff-1",
      role: "VET_NURSE",
      breakMinutes: 30,
      shiftDate: new Date("2026-04-01T00:00:00.000Z"),
      startTime: new Date("2026-04-01T08:00:00.000Z"),
      endTime: new Date("2026-04-01T17:00:00.000Z"),
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects a shift with no start time and never calls the service", async () => {
    const res = buildResponse();

    await StaffShiftController.create(
      buildRequest({ body: { ...validShift, startTime: undefined } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ errors: expect.any(Array) });
    expect(service.schedule).not.toHaveBeenCalled();
  });

  it("passes an overlap conflict through with its own status", async () => {
    service.schedule.mockRejectedValue(
      new StaffShiftError("Shift overlaps an existing one.", 409) as never,
    );
    const res = buildResponse();

    await StaffShiftController.create(buildRequest({ body: validShift }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Shift overlaps an existing one.",
    });
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.schedule.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await StaffShiftController.create(buildRequest({ body: validShift }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("StaffShiftController.get", () => {
  it("looks the shift up inside the organisation", async () => {
    const stored = { id: SHIFT_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await StaffShiftController.get(
      buildRequest({ params: { shiftId: SHIFT_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(SHIFT_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a 404 through", async () => {
    service.get.mockRejectedValue(
      new StaffShiftError("Shift not found.", 404) as never,
    );
    const res = buildResponse();

    await StaffShiftController.get(
      buildRequest({ params: { shiftId: SHIFT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Shift not found." });
  });
});

describe("StaffShiftController.list", () => {
  it("forwards a recognised status and parses the date", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await StaffShiftController.list(
      buildRequest({
        query: {
          staffId: "staff-1",
          role: "VET_NURSE",
          status: "IN_PROGRESS",
          date: "2026-04-01T00:00:00.000Z",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      staffId: "staff-1",
      role: "VET_NURSE",
      status: "IN_PROGRESS",
      date: new Date("2026-04-01T00:00:00.000Z"),
    });
  });

  it("drops an unrecognised status instead of rejecting the request", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await StaffShiftController.list(
      buildRequest({ query: { status: "ON_HOLIDAY" } }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      staffId: undefined,
      role: undefined,
      status: undefined,
      date: undefined,
    });
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.list.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await StaffShiftController.list(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("StaffShiftController.update", () => {
  it("coerces every supplied timestamp", async () => {
    const stored = { id: SHIFT_ID };
    service.update.mockResolvedValue(stored as never);
    const res = buildResponse();

    await StaffShiftController.update(
      buildRequest({
        params: { shiftId: SHIFT_ID },
        body: {
          shiftDate: "2026-04-02T00:00:00.000Z",
          startTime: "2026-04-02T09:00:00.000Z",
          endTime: "2026-04-02T18:00:00.000Z",
          updatedBy: "user-3",
        },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(SHIFT_ID, ORG, {
      updatedBy: "user-3",
      shiftDate: new Date("2026-04-02T00:00:00.000Z"),
      startTime: new Date("2026-04-02T09:00:00.000Z"),
      endTime: new Date("2026-04-02T18:00:00.000Z"),
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("leaves the timestamps undefined when the body only changes the role", async () => {
    service.update.mockResolvedValue({ id: SHIFT_ID } as never);
    const res = buildResponse();

    await StaffShiftController.update(
      buildRequest({
        params: { shiftId: SHIFT_ID },
        body: { role: "RECEPTIONIST" },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(SHIFT_ID, ORG, {
      role: "RECEPTIONIST",
      shiftDate: undefined,
      startTime: undefined,
      endTime: undefined,
    });
  });

  it("rejects a blank role with 400", async () => {
    const res = buildResponse();

    await StaffShiftController.update(
      buildRequest({ params: { shiftId: SHIFT_ID }, body: { role: "" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.update.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await StaffShiftController.update(
      buildRequest({ params: { shiftId: SHIFT_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("StaffShiftController lifecycle transitions", () => {
  it("starts a shift", async () => {
    const stored = { id: SHIFT_ID, status: "IN_PROGRESS" };
    service.start.mockResolvedValue(stored as never);
    const res = buildResponse();

    await StaffShiftController.start(
      buildRequest({ params: { shiftId: SHIFT_ID } }),
      res,
    );

    expect(service.start).toHaveBeenCalledWith(SHIFT_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects starting a shift that is not scheduled", async () => {
    service.start.mockRejectedValue(
      new StaffShiftError("Shift is not scheduled.", 409) as never,
    );
    const res = buildResponse();

    await StaffShiftController.start(
      buildRequest({ params: { shiftId: SHIFT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Shift is not scheduled.",
    });
  });

  it("completes a shift", async () => {
    const stored = { id: SHIFT_ID, status: "COMPLETED" };
    service.complete.mockResolvedValue(stored as never);
    const res = buildResponse();

    await StaffShiftController.complete(
      buildRequest({ params: { shiftId: SHIFT_ID } }),
      res,
    );

    expect(service.complete).toHaveBeenCalledWith(SHIFT_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("hides an unexpected completion failure behind a 500", async () => {
    service.complete.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await StaffShiftController.complete(
      buildRequest({ params: { shiftId: SHIFT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });

  it("cancels a shift and records who cancelled it", async () => {
    const stored = { id: SHIFT_ID, status: "CANCELLED" };
    service.cancel.mockResolvedValue(stored as never);
    const res = buildResponse();

    await StaffShiftController.cancel(
      buildRequest({
        params: { shiftId: SHIFT_ID },
        body: { cancelledBy: "user-4" },
      }),
      res,
    );

    expect(service.cancel).toHaveBeenCalledWith(SHIFT_ID, ORG, "user-4");
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("cancels without a named user when the body is empty", async () => {
    service.cancel.mockResolvedValue({ id: SHIFT_ID } as never);
    const res = buildResponse();

    await StaffShiftController.cancel(
      buildRequest({ params: { shiftId: SHIFT_ID } }),
      res,
    );

    expect(service.cancel).toHaveBeenCalledWith(SHIFT_ID, ORG, undefined);
  });

  it("hides an unexpected cancellation failure behind a 500", async () => {
    service.cancel.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await StaffShiftController.cancel(
      buildRequest({ params: { shiftId: SHIFT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });

  it("marks a shift as a no-show", async () => {
    const stored = { id: SHIFT_ID, status: "NO_SHOW" };
    service.markNoShow.mockResolvedValue(stored as never);
    const res = buildResponse();

    await StaffShiftController.markNoShow(
      buildRequest({ params: { shiftId: SHIFT_ID } }),
      res,
    );

    expect(service.markNoShow).toHaveBeenCalledWith(SHIFT_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a no-show conflict through", async () => {
    service.markNoShow.mockRejectedValue(
      new StaffShiftError("Shift already completed.", 409) as never,
    );
    const res = buildResponse();

    await StaffShiftController.markNoShow(
      buildRequest({ params: { shiftId: SHIFT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Shift already completed.",
    });
  });
});
