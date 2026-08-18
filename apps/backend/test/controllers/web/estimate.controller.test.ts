import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { estimateController } from "../../../src/controllers/web/estimate.controller";
import { EstimateService } from "../../../src/services/estimate.service";

jest.mock("../../../src/services/estimate.service", () => ({
  EstimateService: {
    create: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    markSent: jest.fn(),
    approve: jest.fn(),
    decline: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedService = jest.mocked(EstimateService);

const buildResponse = () => {
  const json = jest.fn();
  const send = jest.fn();
  const status = jest.fn().mockReturnValue({ json, send });
  return { json, send, status } as unknown as Response & {
    json: jest.Mock;
    send: jest.Mock;
    status: jest.Mock;
  };
};

const buildRequest = (overrides: Record<string, unknown> = {}): Request =>
  ({
    params: { organisationId: "org_1", estimateId: "est_1" },
    query: {},
    body: {},
    ...overrides,
  }) as unknown as Request;

const estimate = { id: "est_1", status: "APPROVED" };

describe("estimateController", () => {
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    res = buildResponse();
  });

  describe("create", () => {
    it("creates an estimate with the authenticated user as creator", async () => {
      mockedService.create.mockResolvedValue(estimate as never);
      const req = buildRequest({
        userId: "user_1",
        body: {
          patientId: "pat_1",
          validUntil: "2026-01-01T00:00:00.000Z",
          items: [{ description: "Exam", quantity: 1, unitPrice: 50 }],
        },
      });

      await estimateController.create(req, res);

      expect(mockedService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org_1",
          patientId: "pat_1",
          validUntil: new Date("2026-01-01T00:00:00.000Z"),
          createdBy: "user_1",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(estimate);
    });

    it("rejects an invalid payload", async () => {
      const req = buildRequest({ body: { patientId: "pat_1", items: [] } });

      await estimateController.create(req, res);

      expect(mockedService.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("surfaces the service status code", async () => {
      mockedService.create.mockRejectedValue({
        statusCode: 404,
        message: "Patient not found",
      } as never);
      const req = buildRequest({
        body: {
          patientId: "pat_1",
          items: [{ description: "Exam", quantity: 1, unitPrice: 50 }],
        },
      });

      await estimateController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Patient not found" });
    });
  });

  describe("get", () => {
    it("returns the estimate", async () => {
      mockedService.get.mockResolvedValue(estimate as never);

      await estimateController.get(buildRequest(), res);

      expect(mockedService.get).toHaveBeenCalledWith("est_1", "org_1");
      expect(res.json).toHaveBeenCalledWith(estimate);
    });

    it("defaults to a 500 when the error carries no status code", async () => {
      mockedService.get.mockRejectedValue(new Error("boom") as never);

      await estimateController.get(buildRequest(), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "boom" });
    });
  });

  describe("list", () => {
    it("passes through supported filters", async () => {
      mockedService.list.mockResolvedValue([estimate] as never);
      const req = buildRequest({
        query: { patientId: "pat_1", status: "SENT" },
      });

      await estimateController.list(req, res);

      expect(mockedService.list).toHaveBeenCalledWith({
        organisationId: "org_1",
        patientId: "pat_1",
        status: "SENT",
      });
      expect(res.json).toHaveBeenCalledWith([estimate]);
    });

    it("ignores an unknown status filter", async () => {
      mockedService.list.mockResolvedValue([] as never);
      const req = buildRequest({ query: { status: "BOGUS" } });

      await estimateController.list(req, res);

      expect(mockedService.list).toHaveBeenCalledWith({
        organisationId: "org_1",
        patientId: undefined,
        status: undefined,
      });
    });

    it("surfaces service failures", async () => {
      mockedService.list.mockRejectedValue({
        statusCode: 403,
        message: "Forbidden",
      } as never);

      await estimateController.list(buildRequest(), res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("update", () => {
    it("updates the estimate", async () => {
      mockedService.update.mockResolvedValue(estimate as never);
      const req = buildRequest({
        body: { notes: "Updated", validUntil: "2026-01-01T00:00:00.000Z" },
      });

      await estimateController.update(req, res);

      expect(mockedService.update).toHaveBeenCalledWith("est_1", "org_1", {
        notes: "Updated",
        validUntil: new Date("2026-01-01T00:00:00.000Z"),
      });
      expect(res.json).toHaveBeenCalledWith(estimate);
    });

    it("rejects an invalid payload", async () => {
      const req = buildRequest({ body: { currency: "EURO" } });

      await estimateController.update(req, res);

      expect(mockedService.update).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("surfaces service failures", async () => {
      mockedService.update.mockRejectedValue({
        statusCode: 409,
        message: "Locked",
      } as never);

      await estimateController.update(buildRequest(), res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe("markSent", () => {
    it("marks the estimate as sent", async () => {
      mockedService.markSent.mockResolvedValue(estimate as never);

      await estimateController.markSent(buildRequest(), res);

      expect(mockedService.markSent).toHaveBeenCalledWith("est_1", "org_1");
      expect(res.json).toHaveBeenCalledWith(estimate);
    });

    it("surfaces service failures", async () => {
      mockedService.markSent.mockRejectedValue({
        statusCode: 409,
        message: "Already sent",
      } as never);

      await estimateController.markSent(buildRequest(), res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe("approve", () => {
    it("records the authenticated user and ignores a caller-supplied actorId", async () => {
      mockedService.approve.mockResolvedValue(estimate as never);
      const req = buildRequest({
        userId: "user_1",
        body: { actorId: "someone_else" },
      });

      await estimateController.approve(req, res);

      expect(mockedService.approve).toHaveBeenCalledWith(
        "est_1",
        "org_1",
        "user_1",
      );
      expect(res.json).toHaveBeenCalledWith(estimate);
    });

    it("rejects an unauthenticated request", async () => {
      const req = buildRequest({ body: { actorId: "someone_else" } });

      await estimateController.approve(req, res);

      expect(mockedService.approve).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized: User ID missing",
      });
    });

    it("rejects an invalid payload", async () => {
      const req = buildRequest({ userId: "user_1", body: { reason: 42 } });

      await estimateController.approve(req, res);

      expect(mockedService.approve).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("surfaces service failures", async () => {
      mockedService.approve.mockRejectedValue({
        statusCode: 409,
        message: "Only DRAFT or SENT estimates can be approved.",
      } as never);
      const req = buildRequest({ userId: "user_1" });

      await estimateController.approve(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe("decline", () => {
    it("records the authenticated user and ignores a caller-supplied actorId", async () => {
      mockedService.decline.mockResolvedValue(estimate as never);
      const req = buildRequest({
        userId: "user_1",
        body: { actorId: "someone_else", reason: "Too expensive" },
      });

      await estimateController.decline(req, res);

      expect(mockedService.decline).toHaveBeenCalledWith(
        "est_1",
        "org_1",
        "user_1",
        "Too expensive",
      );
      expect(res.json).toHaveBeenCalledWith(estimate);
    });

    it("rejects an unauthenticated request", async () => {
      const req = buildRequest({ body: { actorId: "someone_else" } });

      await estimateController.decline(req, res);

      expect(mockedService.decline).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized: User ID missing",
      });
    });

    it("rejects an invalid payload", async () => {
      const req = buildRequest({ userId: "user_1", body: { reason: 42 } });

      await estimateController.decline(req, res);

      expect(mockedService.decline).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("surfaces service failures", async () => {
      mockedService.decline.mockRejectedValue({
        statusCode: 409,
        message: "Only DRAFT or SENT estimates can be declined.",
      } as never);
      const req = buildRequest({ userId: "user_1" });

      await estimateController.decline(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe("status code fallback", () => {
    it.each([
      [
        "create",
        {
          patientId: "pat_1",
          items: [{ description: "Exam", quantity: 1, unitPrice: 50 }],
        },
      ],
      ["list", {}],
      ["update", {}],
      ["markSent", {}],
      ["approve", {}],
      ["decline", {}],
      ["delete", {}],
    ] as const)("defaults to 500 for %s", async (name, body) => {
      mockedService[name].mockRejectedValue(new Error("boom") as never);
      const req = buildRequest({ userId: "user_1", body });

      await estimateController[name](req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "boom" });
    });
  });

  describe("delete", () => {
    it("returns 204 on success", async () => {
      mockedService.delete.mockResolvedValue(undefined as never);

      await estimateController.delete(buildRequest(), res);

      expect(mockedService.delete).toHaveBeenCalledWith("est_1", "org_1");
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("surfaces service failures", async () => {
      mockedService.delete.mockRejectedValue({
        statusCode: 404,
        message: "Estimate not found",
      } as never);

      await estimateController.delete(buildRequest(), res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
