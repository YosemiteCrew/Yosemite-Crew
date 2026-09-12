jest.mock("src/services/migration-audit.service", () => ({
  createMigrationAuditRun: jest.fn(),
  getMigrationAuditRun: jest.fn(),
  mintMigrationAuditUploadUrl: jest.fn(),
  MigrationAuditServiceError: class MigrationAuditServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  },
}));

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { MigrationAuditController } from "../../../src/controllers/app/migration-audit.controller";
import {
  createMigrationAuditRun,
  getMigrationAuditRun,
  mintMigrationAuditUploadUrl,
  MigrationAuditServiceError,
} from "../../../src/services/migration-audit.service";

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res) as never;
  res.json = jest.fn().mockReturnValue(res) as never;
  return res;
};

type RequestOverrides = Partial<Request> & {
  organisationId?: string;
  userId?: string;
};

const request = (overrides: RequestOverrides = {}) =>
  ({
    query: {},
    body: {},
    params: {},
    organisationId: "org-1",
    userId: "user-1",
    ...overrides,
  }) as unknown as Request;

describe("MigrationAuditController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUploadUrl", () => {
    it("400s when organisationId is missing", async () => {
      const req = request({ organisationId: undefined });
      const res = mockResponse();

      await MigrationAuditController.getUploadUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mintMigrationAuditUploadUrl).not.toHaveBeenCalled();
    });

    it("returns the presigned URL on success", async () => {
      (mintMigrationAuditUploadUrl as jest.Mock<any>).mockResolvedValue({
        url: "u",
        key: "k",
      });
      const req = request();
      const res = mockResponse();

      await MigrationAuditController.getUploadUrl(req, res);

      expect(mintMigrationAuditUploadUrl).toHaveBeenCalledWith("org-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ url: "u", key: "k" });
    });

    it("maps a MigrationAuditServiceError to its status code", async () => {
      (mintMigrationAuditUploadUrl as jest.Mock<any>).mockRejectedValue(
        new MigrationAuditServiceError("nope", 403),
      );
      const req = request();
      const res = mockResponse();

      await MigrationAuditController.getUploadUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "nope" });
    });

    it("500s on an unexpected error", async () => {
      (mintMigrationAuditUploadUrl as jest.Mock<any>).mockRejectedValue(
        new Error("boom"),
      );
      const req = request();
      const res = mockResponse();

      await MigrationAuditController.getUploadUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createRun", () => {
    const validBody = {
      sourceKeys: {
        owners: "orgs/org-1/owners.csv",
        animals: "orgs/org-1/animals.csv",
        appointments: "orgs/org-1/appointments.csv",
      },
    };

    it("400s when organisationId is missing", async () => {
      const req = request({ organisationId: undefined, body: validBody });
      const res = mockResponse();

      await MigrationAuditController.createRun(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("401s when the caller is not authenticated", async () => {
      const req = request({ userId: undefined, body: validBody });
      const res = mockResponse();

      await MigrationAuditController.createRun(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("400s on a body that fails validation", async () => {
      const req = request({ body: { sourceKeys: { owners: "x" } } });
      const res = mockResponse();

      await MigrationAuditController.createRun(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(createMigrationAuditRun).not.toHaveBeenCalled();
    });

    it("400s on a body with an extra, unrecognised field (strict schema)", async () => {
      const req = request({ body: { ...validBody, extra: "nope" } });
      const res = mockResponse();

      await MigrationAuditController.createRun(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(createMigrationAuditRun).not.toHaveBeenCalled();
    });

    it("creates the run and returns 201 on success", async () => {
      (createMigrationAuditRun as jest.Mock<any>).mockResolvedValue({
        id: "run-1",
        status: "PENDING",
      });
      const req = request({ body: validBody });
      const res = mockResponse();

      await MigrationAuditController.createRun(req, res);

      expect(createMigrationAuditRun).toHaveBeenCalledWith({
        organisationId: "org-1",
        createdByUserId: "user-1",
        sourceKeys: validBody.sourceKeys,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "run-1", status: "PENDING" });
    });

    it("maps a MigrationAuditServiceError to its status code", async () => {
      (createMigrationAuditRun as jest.Mock<any>).mockRejectedValue(
        new MigrationAuditServiceError("bad keys", 400),
      );
      const req = request({ body: validBody });
      const res = mockResponse();

      await MigrationAuditController.createRun(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "bad keys" });
    });
  });

  describe("getRun", () => {
    it("400s when organisationId is missing", async () => {
      const req = request({
        organisationId: undefined,
        params: { auditRunId: "run-1" },
      });
      const res = mockResponse();

      await MigrationAuditController.getRun(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("maps a 404 from the service", async () => {
      (getMigrationAuditRun as jest.Mock<any>).mockRejectedValue(
        new MigrationAuditServiceError("not found", 404),
      );
      const req = request({ params: { auditRunId: "run-1" } });
      const res = mockResponse();

      await MigrationAuditController.getRun(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("renders issues as a FHIR OperationOutcome, with a row reference when present", async () => {
      (getMigrationAuditRun as jest.Mock<any>).mockResolvedValue({
        id: "run-1",
        status: "COMPLETED",
        summary: { OWNERS: { status: "ASSESSED" } },
        errorMessage: null,
        createdAt: new Date("2026-01-01"),
        completedAt: new Date("2026-01-01"),
        issues: [
          {
            severity: "ERROR",
            code: "orphan_reference",
            diagnostics: "row 2 references a missing owner",
            sourceFile: "animals.csv",
            rowNumber: 2,
          },
          {
            severity: "FATAL",
            code: "missing_file",
            diagnostics: "owners.csv was not provided",
            sourceFile: "owners.csv",
            rowNumber: null,
          },
        ],
      });
      const req = request({ params: { auditRunId: "run-1" } });
      const res = mockResponse();

      await MigrationAuditController.getRun(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = (res.json as jest.Mock).mock.calls[0][0] as any;
      expect(body.outcome.resourceType).toBe("OperationOutcome");
      expect(body.outcome.issue[0]).toEqual({
        severity: "error",
        code: "orphan_reference",
        diagnostics: "row 2 references a missing owner",
        expression: ["animals.csv[row 2]"],
      });
      expect(body.outcome.issue[1].expression).toEqual(["owners.csv"]);
    });
  });
});
