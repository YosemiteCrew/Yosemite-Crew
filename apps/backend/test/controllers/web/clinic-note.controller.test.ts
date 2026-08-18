import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { ClinicNoteController } from "../../../src/controllers/web/clinic-note.controller";
import {
  ClinicNoteService,
  ClinicNoteError,
} from "../../../src/services/clinic-note.service";

jest.mock("../../../src/services/clinic-note.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/clinic-note.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    ClinicNoteService: {
      create: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      pin: jest.fn(),
      unpin: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const service = jest.mocked(ClinicNoteService);

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
const NOTE_ID = "note-1";

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

describe("ClinicNoteController.create", () => {
  it("stamps the organisation from the route and answers 201", async () => {
    const stored = { id: NOTE_ID };
    service.create.mockResolvedValue(stored as never);
    const res = buildResponse();

    await ClinicNoteController.create(
      buildRequest({
        body: {
          subjectType: "PATIENT",
          subjectId: "pat-1",
          noteType: "ALERT",
          content: "Owner called about the limp",
          isPinned: true,
          createdBy: "user-1",
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      subjectType: "PATIENT",
      subjectId: "pat-1",
      noteType: "ALERT",
      content: "Owner called about the limp",
      isPinned: true,
      createdBy: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects an unknown subject type with 400 and never calls the service", async () => {
    const res = buildResponse();

    await ClinicNoteController.create(
      buildRequest({
        body: { subjectType: "INVOICE", subjectId: "inv-1", content: "Hi" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Object) });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("passes the empty-content rejection through with its own status", async () => {
    service.create.mockRejectedValue(
      new ClinicNoteError("Note content cannot be empty.", 400) as never,
    );
    const res = buildResponse();

    await ClinicNoteController.create(
      buildRequest({
        body: { subjectType: "CLIENT", subjectId: "client-1", content: " x" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Note content cannot be empty.",
    });
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.create.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await ClinicNoteController.create(
      buildRequest({
        body: { subjectType: "CLIENT", subjectId: "client-1", content: "Hi" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error." });
  });
});

describe("ClinicNoteController.get", () => {
  it("looks the note up inside the organisation", async () => {
    const stored = { id: NOTE_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await ClinicNoteController.get(
      buildRequest({ params: { noteId: NOTE_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(NOTE_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a 404 through", async () => {
    service.get.mockRejectedValue(
      new ClinicNoteError("Clinic note not found.", 404) as never,
    );
    const res = buildResponse();

    await ClinicNoteController.get(
      buildRequest({ params: { noteId: NOTE_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Clinic note not found." });
  });
});

describe("ClinicNoteController.list", () => {
  it("forwards every filter and parses the pinned flag", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await ClinicNoteController.list(
      buildRequest({
        query: {
          subjectType: "PATIENT",
          subjectId: "pat-1",
          noteType: "FOLLOW_UP",
          isPinned: "true",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      subjectType: "PATIENT",
      subjectId: "pat-1",
      noteType: "FOLLOW_UP",
      isPinned: true,
    });
  });

  it("leaves every filter undefined when the query is empty", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await ClinicNoteController.list(buildRequest(), res);

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      subjectType: undefined,
      subjectId: undefined,
      noteType: undefined,
      isPinned: undefined,
    });
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.list.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await ClinicNoteController.list(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error." });
  });
});

describe("ClinicNoteController.update", () => {
  it("forwards the validated changes", async () => {
    const stored = { id: NOTE_ID, content: "Limp resolved" };
    service.update.mockResolvedValue(stored as never);
    const res = buildResponse();

    await ClinicNoteController.update(
      buildRequest({
        params: { noteId: NOTE_ID },
        body: { content: "Limp resolved", noteType: "GENERAL" },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(NOTE_ID, ORG, {
      content: "Limp resolved",
      noteType: "GENERAL",
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects an empty content string with 400", async () => {
    const res = buildResponse();

    await ClinicNoteController.update(
      buildRequest({ params: { noteId: NOTE_ID }, body: { content: "" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.update.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await ClinicNoteController.update(
      buildRequest({ params: { noteId: NOTE_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error." });
  });
});

describe("ClinicNoteController.pin / unpin", () => {
  it("records who pinned the note", async () => {
    const stored = { id: NOTE_ID, isPinned: true };
    service.pin.mockResolvedValue(stored as never);
    const res = buildResponse();

    await ClinicNoteController.pin(
      buildRequest({
        params: { noteId: NOTE_ID },
        body: { pinnedBy: "user-4" },
      }),
      res,
    );

    expect(service.pin).toHaveBeenCalledWith(NOTE_ID, ORG, "user-4");
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("pins without a named user when the body is empty", async () => {
    service.pin.mockResolvedValue({ id: NOTE_ID } as never);
    const res = buildResponse();

    await ClinicNoteController.pin(
      buildRequest({ params: { noteId: NOTE_ID } }),
      res,
    );

    expect(service.pin).toHaveBeenCalledWith(NOTE_ID, ORG, undefined);
  });

  it("passes a 404 from pinning through", async () => {
    service.pin.mockRejectedValue(
      new ClinicNoteError("Clinic note not found.", 404) as never,
    );
    const res = buildResponse();

    await ClinicNoteController.pin(
      buildRequest({ params: { noteId: NOTE_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Clinic note not found." });
  });

  it("unpins the note", async () => {
    const stored = { id: NOTE_ID, isPinned: false };
    service.unpin.mockResolvedValue(stored as never);
    const res = buildResponse();

    await ClinicNoteController.unpin(
      buildRequest({ params: { noteId: NOTE_ID } }),
      res,
    );

    expect(service.unpin).toHaveBeenCalledWith(NOTE_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("hides an unexpected unpin failure behind a 500", async () => {
    service.unpin.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await ClinicNoteController.unpin(
      buildRequest({ params: { noteId: NOTE_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error." });
  });
});

describe("ClinicNoteController.delete", () => {
  it("answers 204 with no body", async () => {
    service.delete.mockResolvedValue(undefined as never);
    const res = buildResponse();

    await ClinicNoteController.delete(
      buildRequest({ params: { noteId: NOTE_ID } }),
      res,
    );

    expect(service.delete).toHaveBeenCalledWith(NOTE_ID, ORG);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("passes a 404 through", async () => {
    service.delete.mockRejectedValue(
      new ClinicNoteError("Clinic note not found.", 404) as never,
    );
    const res = buildResponse();

    await ClinicNoteController.delete(
      buildRequest({ params: { noteId: NOTE_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Clinic note not found." });
  });
});
