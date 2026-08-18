import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { clientComplaintController } from "../../../src/controllers/web/client-complaint.controller";
import { ClientComplaintService } from "../../../src/services/client-complaint.service";

jest.mock("../../../src/services/client-complaint.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/client-complaint.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    ClientComplaintService: {
      create: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      addNote: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const service = jest.mocked(ClientComplaintService);

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
const COMPLAINT_ID = "complaint-1";

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

/** The service throws plain errors carrying a statusCode, not a class. */
const serviceError = (message: string, statusCode: number) =>
  Object.assign(new Error(message), { statusCode });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("clientComplaintController.create", () => {
  it("coerces reportedAt and answers 201", async () => {
    const stored = { id: COMPLAINT_ID, status: "OPEN" };
    service.create.mockResolvedValue(stored as never);
    const res = buildResponse();

    await clientComplaintController.create(
      buildRequest({
        body: {
          clientId: "client-1",
          patientId: "pat-1",
          category: "WAIT_TIMES",
          summary: "Waited 90 minutes",
          reportedAt: "2026-03-25T10:00:00.000Z",
          assignedTo: "user-2",
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      clientId: "client-1",
      patientId: "pat-1",
      category: "WAIT_TIMES",
      summary: "Waited 90 minutes",
      assignedTo: "user-2",
      reportedAt: new Date("2026-03-25T10:00:00.000Z"),
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("leaves reportedAt undefined when the body omits it", async () => {
    service.create.mockResolvedValue({ id: COMPLAINT_ID } as never);
    const res = buildResponse();

    await clientComplaintController.create(
      buildRequest({
        body: { clientId: "client-1", summary: "Rude on phone" },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      clientId: "client-1",
      summary: "Rude on phone",
      reportedAt: undefined,
    });
  });

  it("rejects a blank summary with 400 and never calls the service", async () => {
    const res = buildResponse();

    await clientComplaintController.create(
      buildRequest({ body: { clientId: "client-1", summary: "" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Object) });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("falls back to 500 for an error with no status", async () => {
    service.create.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await clientComplaintController.create(
      buildRequest({ body: { clientId: "client-1", summary: "Concern" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("clientComplaintController.get", () => {
  it("looks the complaint up inside the organisation", async () => {
    const stored = { id: COMPLAINT_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await clientComplaintController.get(
      buildRequest({ params: { complaintId: COMPLAINT_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(COMPLAINT_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("uses the status the service error carries", async () => {
    service.get.mockRejectedValue(
      serviceError("Complaint not found.", 404) as never,
    );
    const res = buildResponse();

    await clientComplaintController.get(
      buildRequest({ params: { complaintId: COMPLAINT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Complaint not found." });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.get.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await clientComplaintController.get(
      buildRequest({ params: { complaintId: COMPLAINT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("clientComplaintController.list", () => {
  it("forwards a recognised status and category", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await clientComplaintController.list(
      buildRequest({
        query: {
          clientId: "client-1",
          status: "INVESTIGATING",
          category: "BILLING",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      clientId: "client-1",
      status: "INVESTIGATING",
      category: "BILLING",
    });
  });

  it("drops unrecognised filters instead of rejecting the request", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await clientComplaintController.list(
      buildRequest({ query: { status: "MAYBE", category: "PARKING" } }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      clientId: undefined,
      status: undefined,
      category: undefined,
    });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.list.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await clientComplaintController.list(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("clientComplaintController.update", () => {
  it("coerces resolvedAt alongside the status change", async () => {
    const stored = { id: COMPLAINT_ID, status: "RESOLVED" };
    service.update.mockResolvedValue(stored as never);
    const res = buildResponse();

    await clientComplaintController.update(
      buildRequest({
        params: { complaintId: COMPLAINT_ID },
        body: {
          status: "RESOLVED",
          resolvedAt: "2026-03-27T12:00:00.000Z",
          resolutionNotes: "Fee waived",
        },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(COMPLAINT_ID, ORG, {
      status: "RESOLVED",
      resolutionNotes: "Fee waived",
      resolvedAt: new Date("2026-03-27T12:00:00.000Z"),
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("leaves resolvedAt undefined when it is not supplied", async () => {
    service.update.mockResolvedValue({ id: COMPLAINT_ID } as never);
    const res = buildResponse();

    await clientComplaintController.update(
      buildRequest({
        params: { complaintId: COMPLAINT_ID },
        body: { status: "ESCALATED" },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(COMPLAINT_ID, ORG, {
      status: "ESCALATED",
      resolvedAt: undefined,
    });
  });

  it("rejects an unknown status with 400", async () => {
    const res = buildResponse();

    await clientComplaintController.update(
      buildRequest({
        params: { complaintId: COMPLAINT_ID },
        body: { status: "FORGOTTEN" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("uses the status the service error carries", async () => {
    service.update.mockRejectedValue(
      serviceError("Complaint not found.", 404) as never,
    );
    const res = buildResponse();

    await clientComplaintController.update(
      buildRequest({ params: { complaintId: COMPLAINT_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("falls back to 500 for an error with no status", async () => {
    service.update.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await clientComplaintController.update(
      buildRequest({ params: { complaintId: COMPLAINT_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("clientComplaintController.addNote", () => {
  it("answers 201 with the stored note", async () => {
    const stored = { id: "note-1" };
    service.addNote.mockResolvedValue(stored as never);
    const res = buildResponse();

    await clientComplaintController.addNote(
      buildRequest({
        params: { complaintId: COMPLAINT_ID },
        body: {
          content: "Called the client back",
          authorId: "user-3",
          isInternal: true,
        },
      }),
      res,
    );

    expect(service.addNote).toHaveBeenCalledWith(COMPLAINT_ID, ORG, {
      content: "Called the client back",
      authorId: "user-3",
      isInternal: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects an empty note with 400", async () => {
    const res = buildResponse();

    await clientComplaintController.addNote(
      buildRequest({
        params: { complaintId: COMPLAINT_ID },
        body: { content: "" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.addNote).not.toHaveBeenCalled();
  });

  it("falls back to 500 for an error with no status", async () => {
    service.addNote.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await clientComplaintController.addNote(
      buildRequest({
        params: { complaintId: COMPLAINT_ID },
        body: { content: "Noted" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("clientComplaintController.delete", () => {
  it("answers 204 with no body", async () => {
    service.delete.mockResolvedValue(undefined as never);
    const res = buildResponse();

    await clientComplaintController.delete(
      buildRequest({ params: { complaintId: COMPLAINT_ID } }),
      res,
    );

    expect(service.delete).toHaveBeenCalledWith(COMPLAINT_ID, ORG);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });

  it("uses the status the service error carries", async () => {
    service.delete.mockRejectedValue(
      serviceError("Complaint not found.", 404) as never,
    );
    const res = buildResponse();

    await clientComplaintController.delete(
      buildRequest({ params: { complaintId: COMPLAINT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Complaint not found." });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.delete.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await clientComplaintController.delete(
      buildRequest({ params: { complaintId: COMPLAINT_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});
