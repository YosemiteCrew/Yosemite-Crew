import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { PatientCheckInController } from "../../../src/controllers/web/patient-check-in.controller";
import {
  PatientCheckInService,
  PatientCheckInError,
} from "../../../src/services/patient-check-in.service";

jest.mock("../../../src/services/patient-check-in.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/patient-check-in.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    PatientCheckInService: {
      create: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      markSeen: jest.fn(),
      complete: jest.fn(),
      cancel: jest.fn(),
      markNoShow: jest.fn(),
      assignRoom: jest.fn(),
    },
  };
});

const service = jest.mocked(PatientCheckInService);

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
const CHECK_IN_ID = "checkin-1";

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

describe("PatientCheckInController.create", () => {
  it("coerces the arrival timestamp to a Date and answers 201", async () => {
    const stored = { id: CHECK_IN_ID, status: "WAITING" };
    service.create.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientCheckInController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          clientId: "client-1",
          appointmentId: "appt-1",
          arrivedAt: "2026-04-01T09:00:00.000Z",
          triagePriority: "URGENT",
          triageNote: "Limping on the left hind",
          checkedInBy: "recep-1",
          notes: "Owner waiting in the car park",
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      clientId: "client-1",
      appointmentId: "appt-1",
      arrivedAt: new Date("2026-04-01T09:00:00.000Z"),
      triagePriority: "URGENT",
      triageNote: "Limping on the left hind",
      checkedInBy: "recep-1",
      notes: "Owner waiting in the car park",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("omits every optional field when only the required ones are sent", async () => {
    service.create.mockResolvedValue({ id: CHECK_IN_ID } as never);
    const res = buildResponse();

    await PatientCheckInController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          clientId: "client-1",
          arrivedAt: "2026-04-01T09:00:00.000Z",
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      clientId: "client-1",
      arrivedAt: new Date("2026-04-01T09:00:00.000Z"),
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects a non-datetime arrival with 400 and never calls the service", async () => {
    const res = buildResponse();

    await PatientCheckInController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          clientId: "client-1",
          arrivedAt: "this morning",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Array) });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("rejects a missing client with 400", async () => {
    const res = buildResponse();

    await PatientCheckInController.create(
      buildRequest({
        body: { patientId: "pat-1", arrivedAt: "2026-04-01T09:00:00.000Z" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown triage priority with 400", async () => {
    const res = buildResponse();

    await PatientCheckInController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          clientId: "client-1",
          arrivedAt: "2026-04-01T09:00:00.000Z",
          triagePriority: "WHENEVER",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("lets a service failure reach the error middleware instead of answering", async () => {
    service.create.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await expect(
      PatientCheckInController.create(
        buildRequest({
          body: {
            patientId: "pat-1",
            clientId: "client-1",
            arrivedAt: "2026-04-01T09:00:00.000Z",
          },
        }),
        res,
      ),
    ).rejects.toThrow("db down");
    expect(res.json).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("PatientCheckInController.get", () => {
  it("looks the check-in up inside the organisation", async () => {
    const stored = { id: CHECK_IN_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientCheckInController.get(
      buildRequest({ params: { checkInId: CHECK_IN_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(CHECK_IN_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("propagates the not-found error rather than answering 200", async () => {
    service.get.mockRejectedValue(
      new PatientCheckInError("Check-in record not found.", 404) as never,
    );
    const res = buildResponse();

    await expect(
      PatientCheckInController.get(
        buildRequest({ params: { checkInId: CHECK_IN_ID } }),
        res,
      ),
    ).rejects.toMatchObject({
      message: "Check-in record not found.",
      statusCode: 404,
    });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("PatientCheckInController.list", () => {
  it("forwards the filters and coerces the date to a Date", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await PatientCheckInController.list(
      buildRequest({
        query: {
          patientId: "pat-1",
          status: "WAITING",
          date: "2026-04-01T00:00:00.000Z",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      status: "WAITING",
      date: new Date("2026-04-01T00:00:00.000Z"),
    });
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("passes only the organisation when the query is empty", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await PatientCheckInController.list(buildRequest(), res);

    expect(service.list).toHaveBeenCalledWith({ organisationId: ORG });
  });

  it("rejects an unknown status with 400 and never calls the service", async () => {
    const res = buildResponse();

    await PatientCheckInController.list(
      buildRequest({ query: { status: "QUEUED" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Array) });
    expect(service.list).not.toHaveBeenCalled();
  });

  it("rejects a non-datetime date with 400", async () => {
    const res = buildResponse();

    await PatientCheckInController.list(
      buildRequest({ query: { date: "2026-04-01" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.list).not.toHaveBeenCalled();
  });
});

describe("PatientCheckInController.markSeen", () => {
  it("marks the check-in seen inside the organisation", async () => {
    const stored = { id: CHECK_IN_ID, status: "IN_CONSULTATION" };
    service.markSeen.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientCheckInController.markSeen(
      buildRequest({ params: { checkInId: CHECK_IN_ID } }),
      res,
    );

    expect(service.markSeen).toHaveBeenCalledWith(CHECK_IN_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("propagates the terminal-status conflict", async () => {
    service.markSeen.mockRejectedValue(
      new PatientCheckInError(
        "Cannot mark as seen a check-in with status CANCELLED.",
        409,
      ) as never,
    );
    const res = buildResponse();

    await expect(
      PatientCheckInController.markSeen(
        buildRequest({ params: { checkInId: CHECK_IN_ID } }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("PatientCheckInController.complete", () => {
  it("completes the check-in inside the organisation", async () => {
    const stored = { id: CHECK_IN_ID, status: "COMPLETED" };
    service.complete.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientCheckInController.complete(
      buildRequest({ params: { checkInId: CHECK_IN_ID } }),
      res,
    );

    expect(service.complete).toHaveBeenCalledWith(CHECK_IN_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("propagates the terminal-status conflict", async () => {
    service.complete.mockRejectedValue(
      new PatientCheckInError(
        "Cannot complete a check-in with status NO_SHOW.",
        409,
      ) as never,
    );
    const res = buildResponse();

    await expect(
      PatientCheckInController.complete(
        buildRequest({ params: { checkInId: CHECK_IN_ID } }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("PatientCheckInController.cancel", () => {
  it("cancels the check-in inside the organisation", async () => {
    const stored = { id: CHECK_IN_ID, status: "CANCELLED" };
    service.cancel.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientCheckInController.cancel(
      buildRequest({ params: { checkInId: CHECK_IN_ID } }),
      res,
    );

    expect(service.cancel).toHaveBeenCalledWith(CHECK_IN_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("propagates the not-found error", async () => {
    service.cancel.mockRejectedValue(
      new PatientCheckInError("Check-in record not found.", 404) as never,
    );
    const res = buildResponse();

    await expect(
      PatientCheckInController.cancel(
        buildRequest({ params: { checkInId: CHECK_IN_ID } }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("PatientCheckInController.markNoShow", () => {
  it("marks the check-in a no-show inside the organisation", async () => {
    const stored = { id: CHECK_IN_ID, status: "NO_SHOW" };
    service.markNoShow.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientCheckInController.markNoShow(
      buildRequest({ params: { checkInId: CHECK_IN_ID } }),
      res,
    );

    expect(service.markNoShow).toHaveBeenCalledWith(CHECK_IN_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("propagates the terminal-status conflict", async () => {
    service.markNoShow.mockRejectedValue(
      new PatientCheckInError(
        "Cannot mark no-show for a check-in with status COMPLETED.",
        409,
      ) as never,
    );
    const res = buildResponse();

    await expect(
      PatientCheckInController.markNoShow(
        buildRequest({ params: { checkInId: CHECK_IN_ID } }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("PatientCheckInController.assignRoom", () => {
  it("unwraps the room id before handing it to the service", async () => {
    const stored = { id: CHECK_IN_ID, assignedRoomId: "room-3" };
    service.assignRoom.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientCheckInController.assignRoom(
      buildRequest({
        params: { checkInId: CHECK_IN_ID },
        body: { roomId: "room-3" },
      }),
      res,
    );

    expect(service.assignRoom).toHaveBeenCalledWith(CHECK_IN_ID, ORG, "room-3");
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects a body with no room id with 400 and never calls the service", async () => {
    const res = buildResponse();

    await PatientCheckInController.assignRoom(
      buildRequest({ params: { checkInId: CHECK_IN_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Array) });
    expect(service.assignRoom).not.toHaveBeenCalled();
  });

  it("rejects a non-string room id with 400", async () => {
    const res = buildResponse();

    await PatientCheckInController.assignRoom(
      buildRequest({
        params: { checkInId: CHECK_IN_ID },
        body: { roomId: 3 },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.assignRoom).not.toHaveBeenCalled();
  });

  it("propagates the not-found error", async () => {
    service.assignRoom.mockRejectedValue(
      new PatientCheckInError("Check-in record not found.", 404) as never,
    );
    const res = buildResponse();

    await expect(
      PatientCheckInController.assignRoom(
        buildRequest({
          params: { checkInId: CHECK_IN_ID },
          body: { roomId: "room-3" },
        }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(res.json).not.toHaveBeenCalled();
  });
});
