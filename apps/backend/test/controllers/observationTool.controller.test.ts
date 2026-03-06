import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
// ----------------------------------------------------------------------
// 1. FIXED IMPORTS: Up 2 levels to src
// ----------------------------------------------------------------------
import {
  ObservationToolDefinitionController,
  ObservationToolSubmissionController,
} from "../../src/controllers/web/observationTool.controller";

import {
  ObservationToolDefinitionService,
  ObservationToolDefinitionServiceError,
} from "../../src/services/observationToolDefinition.service";

import {
  ObservationToolSubmissionService,
  ObservationToolSubmissionServiceError,
} from "../../src/services/observationToolSubmission.service";

import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { TaskService } from "../../src/services/task.service";

// ----------------------------------------------------------------------
// 2. MOCK FACTORY
// ----------------------------------------------------------------------
jest.mock("../../src/services/observationToolDefinition.service");
jest.mock("../../src/services/observationToolSubmission.service");
jest.mock("../../src/services/authUserMobile.service");
jest.mock("../../src/services/task.service");

// Retrieve REAL error classes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ObservationToolDefinitionServiceError: RealDefError } =
  jest.requireActual(
    "../../src/services/observationToolDefinition.service",
  ) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ObservationToolSubmissionServiceError: RealSubError } =
  jest.requireActual(
    "../../src/services/observationToolSubmission.service",
  ) as any;

// ----------------------------------------------------------------------
// 3. TYPED MOCKS
// ----------------------------------------------------------------------
const mockedDefService = jest.mocked(ObservationToolDefinitionService);
const mockedSubService = jest.mocked(ObservationToolSubmissionService);
const mockedAuthService = jest.mocked(AuthUserMobileService);
const mockedTaskService = jest.mocked(TaskService);

describe("ObservationTool Controllers", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    sendMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });

    req = {
      headers: {},
      params: {},
      body: {},
      query: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------------
  // 4. ERROR HELPERS (FIXED CASTING)
  // ----------------------------------------------------------------------
  const mockDefError = (
    method: keyof typeof ObservationToolDefinitionService,
    status = 400,
    msg = "Def Error",
  ) => {
    const error = new RealDefError(msg, status);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedDefService[method] as any).mockRejectedValue(error);
  };

  const mockSubError = (
    method: keyof typeof ObservationToolSubmissionService,
    status = 400,
    msg = "Sub Error",
  ) => {
    const error = new RealSubError(msg, status);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockedSubService[method] as any).mockRejectedValue(error);
  };

  const mockGenericError = (mockFn: jest.Mock) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFn as any).mockRejectedValue(new Error("Boom"));
  };

  /* ========================================================================
   * DEFINITION CONTROLLER
   * ======================================================================*/
  describe("ObservationToolDefinitionController", () => {
    describe("create", () => {
      it("should success (201)", async () => {
        req.body = { name: "Tool A" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedDefService.create as any).mockResolvedValue({ id: "t1" });

        await ObservationToolDefinitionController.create(
          req as any,
          res as Response,
        );
        expect(mockedDefService.create).toHaveBeenCalledWith(req.body);
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it("should handle service error", async () => {
        mockDefError("create", 400);
        await ObservationToolDefinitionController.create(
          req as any,
          res as Response,
        );
      });

      it("should handle generic error", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockGenericError(mockedDefService.create as any);
        await ObservationToolDefinitionController.create(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("update", () => {
      it("should success (200)", async () => {
        req.params = { toolId: "t1" };
        req.body = { name: "Updated" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedDefService.update as any).mockResolvedValue({ id: "t1" });

        await ObservationToolDefinitionController.update(
          req as any,
          res as Response,
        );
        expect(mockedDefService.update).toHaveBeenCalledWith("t1", req.body);
        expect(jsonMock).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        mockDefError("update", 404);
        await ObservationToolDefinitionController.update(
          req as any,
          res as Response,
        );
      });
    });

    describe("archive", () => {
      it("should success (204)", async () => {
        req.params = { toolId: "t1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedDefService.archive as any).mockResolvedValue(undefined);

        await ObservationToolDefinitionController.archive(
          req as any,
          res as Response,
        );
        expect(mockedDefService.archive).toHaveBeenCalledWith("t1");
        expect(statusMock).toHaveBeenCalledWith(204);
      });

      it("should handle error", async () => {
        mockDefError("archive", 500);
        await ObservationToolDefinitionController.archive(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("list", () => {
      it("should list with filters", async () => {
        req.query = { category: "cat1", onlyActive: "true" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedDefService.list as any).mockResolvedValue([]);

        await ObservationToolDefinitionController.list(
          req as any,
          res as Response,
        );
        expect(mockedDefService.list).toHaveBeenCalledWith({
          category: "cat1",
          onlyActive: true,
        });
        expect(jsonMock).toHaveBeenCalledWith([]);
      });

      it("should list with numeric active flag", async () => {
        req.query = { onlyActive: "1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedDefService.list as any).mockResolvedValue([]);

        await ObservationToolDefinitionController.list(
          req as any,
          res as Response,
        );
        expect(mockedDefService.list).toHaveBeenCalledWith({
          category: undefined,
          onlyActive: true,
        });
      });

      it("should handle error", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockGenericError(mockedDefService.list as any);
        await ObservationToolDefinitionController.list(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("getById", () => {
      it("should success", async () => {
        req.params = { toolId: "t1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedDefService.getById as any).mockResolvedValue({});

        await ObservationToolDefinitionController.getById(
          req as any,
          res as Response,
        );
        expect(mockedDefService.getById).toHaveBeenCalledWith("t1");
      });

      it("should handle error", async () => {
        mockDefError("getById", 404);
        await ObservationToolDefinitionController.getById(
          req as any,
          res as Response,
        );
      });
    });
  });

  /* ========================================================================
   * SUBMISSION CONTROLLER
   * ======================================================================*/
  describe("ObservationToolSubmissionController", () => {
    describe("createFromMobile", () => {
      it("should 401 if unauthenticated", async () => {
        await ObservationToolSubmissionController.createFromMobile(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(401);
      });

      it("should 403 if parent not found", async () => {
        (req as any).userId = "u1";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({
          parentId: null,
        });

        await ObservationToolSubmissionController.createFromMobile(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(403);
      });

      it("should 400 if companionId missing", async () => {
        (req as any).userId = "u1";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({
          parentId: "p1",
        });
        req.body = { answers: {} }; // missing companionId

        await ObservationToolSubmissionController.createFromMobile(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should 400 if answers missing", async () => {
        (req as any).userId = "u1";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({
          parentId: "p1",
        });
        req.body = { companionId: "c1" }; // missing answers

        await ObservationToolSubmissionController.createFromMobile(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it("should success (201)", async () => {
        (req as any).userId = "u1";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({
          parentId: "p1",
        });
        req.params = { toolId: "t1" };
        req.body = {
          companionId: "c1",
          answers: { q1: "a1" },
          summary: "sum",
          taskId: "tsk1",
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedSubService.createSubmission as any).mockResolvedValue({
          id: "s1",
        });

        await ObservationToolSubmissionController.createFromMobile(
          req as any,
          res as Response,
        );

        expect(mockedSubService.createSubmission).toHaveBeenCalledWith({
          toolId: "t1",
          taskId: "tsk1",
          companionId: "c1",
          filledBy: "p1",
          answers: { q1: "a1" },
          summary: "sum",
        });
        expect(statusMock).toHaveBeenCalledWith(201);
      });

      it("should handle service error", async () => {
        (req as any).userId = "u1";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedAuthService.getByProviderUserId as any).mockResolvedValue({
          parentId: "p1",
        });
        req.body = { companionId: "c1", answers: {} };
        mockSubError("createSubmission", 400);

        await ObservationToolSubmissionController.createFromMobile(
          req as any,
          res as Response,
        );
      });
    });

    describe("listForPms", () => {
      it("should list with full filters", async () => {
        req.query = {
          companionId: "c1",
          toolId: "t1",
          fromDate: "2023-01-01",
          toDate: "2023-01-31",
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedSubService.listSubmissions as any).mockResolvedValue([]);

        await ObservationToolSubmissionController.listForPms(
          req as any,
          res as Response,
        );

        expect(mockedSubService.listSubmissions).toHaveBeenCalledWith({
          companionId: "c1",
          toolId: "t1",
          fromDate: new Date("2023-01-01"),
          toDate: new Date("2023-01-31"),
        });
        expect(jsonMock).toHaveBeenCalledWith([]);
      });

      it("should list with minimal filters", async () => {
        req.query = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedSubService.listSubmissions as any).mockResolvedValue([]);

        await ObservationToolSubmissionController.listForPms(
          req as any,
          res as Response,
        );
        expect(mockedSubService.listSubmissions).toHaveBeenCalledWith({
          companionId: undefined,
          toolId: undefined,
          fromDate: undefined,
          toDate: undefined,
        });
      });

      it("should handle error", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockGenericError(mockedSubService.listSubmissions as any);
        await ObservationToolSubmissionController.listForPms(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("getById", () => {
      it("should 404 if not found", async () => {
        req.params = { submissionId: "s1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedSubService.getById as any).mockResolvedValue(null);
        await ObservationToolSubmissionController.getById(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it("should success", async () => {
        req.params = { submissionId: "s1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedSubService.getById as any).mockResolvedValue({ id: "s1" });
        await ObservationToolSubmissionController.getById(
          req as any,
          res as Response,
        );
        expect(jsonMock).toHaveBeenCalledWith({ id: "s1" });
      });

      it("should handle service error", async () => {
        mockSubError("getById", 400);
        await ObservationToolSubmissionController.getById(
          req as any,
          res as Response,
        );
      });
    });

    describe("linkAppointment", () => {
      it("should link and return updated", async () => {
        req.params = { submissionId: "s1" };
        req.body = { appointmentId: "apt1", enforceSingle: true };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedSubService.linkToAppointment as any).mockResolvedValue({
          taskId: "tsk1",
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedTaskService.linkToAppointment as any).mockResolvedValue(
          undefined,
        );

        await ObservationToolSubmissionController.linkAppointment(
          req as any,
          res as Response,
        );

        expect(mockedSubService.linkToAppointment).toHaveBeenCalledWith({
          submissionId: "s1",
          appointmentId: "apt1",
          enforceSingleSubmissionPerAppointment: true,
        });
        expect(mockedTaskService.linkToAppointment).toHaveBeenCalledWith({
          taskId: "tsk1",
          appointmentId: "apt1",
        });
        expect(jsonMock).toHaveBeenCalledWith({ taskId: "tsk1" });
      });

      it("should handle service error", async () => {
        req.params = { submissionId: "s1" };
        req.body = { appointmentId: "apt1" };
        mockSubError("linkToAppointment", 409);
        await ObservationToolSubmissionController.linkAppointment(
          req as any,
          res as Response,
        );
      });
    });

    describe("listForAppointment", () => {
      it("should success", async () => {
        req.params = { appointmentId: "apt1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedSubService.listForAppointment as any).mockResolvedValue([]);
        await ObservationToolSubmissionController.listForAppointment(
          req as any,
          res as Response,
        );
        expect(mockedSubService.listForAppointment).toHaveBeenCalledWith(
          "apt1",
        );
      });

      it("should handle error", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockGenericError(mockedSubService.listForAppointment as any);
        await ObservationToolSubmissionController.listForAppointment(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });

    describe("getByTaskId", () => {
      it("should 404 if not found", async () => {
        req.params = { taskId: "tsk1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedSubService.getByTaskId as any).mockResolvedValue(null);
        await ObservationToolSubmissionController.getByTaskId(
          req as any,
          res as Response,
        );
        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it("should success", async () => {
        req.params = { taskId: "tsk1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedSubService.getByTaskId as any).mockResolvedValue({});
        await ObservationToolSubmissionController.getByTaskId(
          req as any,
          res as Response,
        );
        expect(jsonMock).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        mockSubError("getByTaskId", 400);
        await ObservationToolSubmissionController.getByTaskId(
          req as any,
          res as Response,
        );
      });
    });

    describe("getPreviewByTaskId", () => {
      it("should success", async () => {
        req.params = { taskId: "tsk1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockedSubService.getPreviewByTaskId as any).mockResolvedValue({});
        await ObservationToolSubmissionController.getPreviewByTaskId(
          req as any,
          res as Response,
        );
        expect(jsonMock).toHaveBeenCalled();
      });

      it("should handle error", async () => {
        mockSubError("getPreviewByTaskId", 404);
        await ObservationToolSubmissionController.getPreviewByTaskId(
          req as any,
          res as Response,
        );
      });
    });

    describe("listTaskPreviewsForAppointment", () => {
      it("should success", async () => {
        req.params = { appointmentId: "apt1" };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (
          mockedSubService.listTaskPreviewsForAppointment as any
        ).mockResolvedValue([]);
        await ObservationToolSubmissionController.listTaskPreviewsForAppointment(
          req as any,
          res as Response,
        );
        expect(jsonMock).toHaveBeenCalledWith([]);
      });

      it("should handle error", async () => {
        mockSubError("listTaskPreviewsForAppointment", 400);
        await ObservationToolSubmissionController.listTaskPreviewsForAppointment(
          req as any,
          res as Response,
        );
      });
    });
  });
});
