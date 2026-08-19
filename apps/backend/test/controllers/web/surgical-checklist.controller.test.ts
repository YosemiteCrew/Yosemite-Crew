import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { surgicalChecklistController } from "../../../src/controllers/web/surgical-checklist.controller";
import { SurgicalChecklistService } from "../../../src/services/surgical-checklist.service";

jest.mock("../../../src/services/surgical-checklist.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/surgical-checklist.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    SurgicalChecklistService: {
      create: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      checkItem: jest.fn(),
      uncheckItem: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const service = jest.mocked(SurgicalChecklistService);

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
const CHECKLIST_ID = "checklist-1";
const ITEM_ID = "item-1";

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

describe("surgicalChecklistController.create", () => {
  it("stamps the organisation from the route and answers 201", async () => {
    const stored = { id: CHECKLIST_ID, phase: "SIGN_IN" };
    service.create.mockResolvedValue(stored as never);
    const res = buildResponse();

    await surgicalChecklistController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          encounterId: "enc-1",
          phase: "SIGN_IN",
          conductedBy: "Nurse Bell",
          items: [
            { label: "Patient identity confirmed", sortOrder: 1 },
            { label: "Consent signed", sortOrder: 2 },
          ],
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      encounterId: "enc-1",
      phase: "SIGN_IN",
      conductedBy: "Nurse Bell",
      items: [
        { label: "Patient identity confirmed", sortOrder: 1 },
        { label: "Consent signed", sortOrder: 2 },
      ],
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects an item with a blank label and never calls the service", async () => {
    const res = buildResponse();

    await surgicalChecklistController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          encounterId: "enc-1",
          items: [{ label: "" }],
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Object) });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("uses the status the service error carries", async () => {
    service.create.mockRejectedValue(
      serviceError("Encounter not found.", 404) as never,
    );
    const res = buildResponse();

    await surgicalChecklistController.create(
      buildRequest({ body: { patientId: "pat-1", encounterId: "enc-1" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Encounter not found." });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.create.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await surgicalChecklistController.create(
      buildRequest({ body: { patientId: "pat-1", encounterId: "enc-1" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("surgicalChecklistController.get", () => {
  it("looks the checklist up inside the organisation", async () => {
    const stored = { id: CHECKLIST_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await surgicalChecklistController.get(
      buildRequest({ params: { checklistId: CHECKLIST_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(CHECKLIST_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a 404 through", async () => {
    service.get.mockRejectedValue(
      serviceError("Checklist not found.", 404) as never,
    );
    const res = buildResponse();

    await surgicalChecklistController.get(
      buildRequest({ params: { checklistId: CHECKLIST_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Checklist not found." });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.get.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await surgicalChecklistController.get(
      buildRequest({ params: { checklistId: CHECKLIST_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("surgicalChecklistController.list", () => {
  it("forwards a recognised status", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await surgicalChecklistController.list(
      buildRequest({
        query: {
          patientId: "pat-1",
          encounterId: "enc-1",
          status: "IN_PROGRESS",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      encounterId: "enc-1",
      status: "IN_PROGRESS",
    });
  });

  it("drops an unrecognised status instead of rejecting the request", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await surgicalChecklistController.list(
      buildRequest({ query: { status: "HALF_DONE" } }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: undefined,
      encounterId: undefined,
      status: undefined,
    });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.list.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await surgicalChecklistController.list(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("surgicalChecklistController.update", () => {
  it("coerces completedAt alongside the status change", async () => {
    const stored = { id: CHECKLIST_ID, status: "COMPLETED" };
    service.update.mockResolvedValue(stored as never);
    const res = buildResponse();

    await surgicalChecklistController.update(
      buildRequest({
        params: { checklistId: CHECKLIST_ID },
        body: {
          phase: "SIGN_OUT",
          status: "COMPLETED",
          completedAt: "2026-03-28T11:30:00.000Z",
        },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(CHECKLIST_ID, ORG, {
      phase: "SIGN_OUT",
      status: "COMPLETED",
      completedAt: new Date("2026-03-28T11:30:00.000Z"),
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("leaves completedAt undefined when it is not supplied", async () => {
    service.update.mockResolvedValue({ id: CHECKLIST_ID } as never);
    const res = buildResponse();

    await surgicalChecklistController.update(
      buildRequest({
        params: { checklistId: CHECKLIST_ID },
        body: { phase: "TIME_OUT" },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(CHECKLIST_ID, ORG, {
      phase: "TIME_OUT",
      completedAt: undefined,
    });
  });

  it("rejects an unknown phase with 400", async () => {
    const res = buildResponse();

    await surgicalChecklistController.update(
      buildRequest({
        params: { checklistId: CHECKLIST_ID },
        body: { phase: "SCRUB_IN" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("falls back to 500 for an error with no status", async () => {
    service.update.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await surgicalChecklistController.update(
      buildRequest({ params: { checklistId: CHECKLIST_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("surgicalChecklistController.checkItem / uncheckItem", () => {
  it("checks an item and records who checked it", async () => {
    const stored = { id: ITEM_ID, isChecked: true };
    service.checkItem.mockResolvedValue(stored as never);
    const res = buildResponse();

    await surgicalChecklistController.checkItem(
      buildRequest({
        params: { checklistId: CHECKLIST_ID, itemId: ITEM_ID },
        body: { checkedBy: "Nurse Bell", notes: "Confirmed with the owner" },
      }),
      res,
    );

    expect(service.checkItem).toHaveBeenCalledWith(CHECKLIST_ID, ITEM_ID, ORG, {
      checkedBy: "Nurse Bell",
      notes: "Confirmed with the owner",
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects a non-string note with 400", async () => {
    const res = buildResponse();

    await surgicalChecklistController.checkItem(
      buildRequest({
        params: { checklistId: CHECKLIST_ID, itemId: ITEM_ID },
        body: { notes: 42 },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.checkItem).not.toHaveBeenCalled();
  });

  it("passes a 404 from checking through", async () => {
    service.checkItem.mockRejectedValue(
      serviceError("Checklist item not found.", 404) as never,
    );
    const res = buildResponse();

    await surgicalChecklistController.checkItem(
      buildRequest({
        params: { checklistId: CHECKLIST_ID, itemId: ITEM_ID },
        body: {},
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Checklist item not found.",
    });
  });

  it("falls back to 500 when checking fails without a status", async () => {
    service.checkItem.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await surgicalChecklistController.checkItem(
      buildRequest({
        params: { checklistId: CHECKLIST_ID, itemId: ITEM_ID },
        body: {},
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });

  it("unchecks an item", async () => {
    const stored = { id: ITEM_ID, isChecked: false };
    service.uncheckItem.mockResolvedValue(stored as never);
    const res = buildResponse();

    await surgicalChecklistController.uncheckItem(
      buildRequest({ params: { checklistId: CHECKLIST_ID, itemId: ITEM_ID } }),
      res,
    );

    expect(service.uncheckItem).toHaveBeenCalledWith(
      CHECKLIST_ID,
      ITEM_ID,
      ORG,
    );
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("falls back to 500 when unchecking fails without a status", async () => {
    service.uncheckItem.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await surgicalChecklistController.uncheckItem(
      buildRequest({ params: { checklistId: CHECKLIST_ID, itemId: ITEM_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("surgicalChecklistController.delete", () => {
  it("answers 204 with no body", async () => {
    service.delete.mockResolvedValue(undefined as never);
    const res = buildResponse();

    await surgicalChecklistController.delete(
      buildRequest({ params: { checklistId: CHECKLIST_ID } }),
      res,
    );

    expect(service.delete).toHaveBeenCalledWith(CHECKLIST_ID, ORG);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });

  it("uses the status the service error carries", async () => {
    service.delete.mockRejectedValue(
      serviceError("Checklist not found.", 404) as never,
    );
    const res = buildResponse();

    await surgicalChecklistController.delete(
      buildRequest({ params: { checklistId: CHECKLIST_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Checklist not found." });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.delete.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await surgicalChecklistController.delete(
      buildRequest({ params: { checklistId: CHECKLIST_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});
