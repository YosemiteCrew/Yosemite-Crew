import type { Request, Response } from "express";
import { SavedReportController } from "src/controllers/web/saved-report.controller";
import {
  SavedReportService,
  SavedReportServiceError,
} from "src/services/saved-report.service";

jest.mock("src/services/saved-report.service", () => ({
  SavedReportServiceError: class SavedReportServiceError extends Error {
    constructor(
      message: string,
      public statusCode = 400,
    ) {
      super(message);
    }
  },
  SavedReportService: {
    listViews: jest.fn(),
    createView: jest.fn(),
    updateView: jest.fn(),
    deleteView: jest.fn(),
    listSchedules: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
  },
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));

const service = jest.mocked(SavedReportService);

describe("SavedReportController", () => {
  let req: Request;
  let res: Response;
  let json: jest.Mock;
  let status: jest.Mock;
  let send: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    send = jest.fn();
    status = jest.fn().mockReturnValue({ json, send });
    req = {
      params: {
        organisationId: "org-1",
        viewId: "view-1",
        scheduleId: "schedule-1",
      },
      body: {},
      userId: "user-1",
    } as unknown as Request;
    res = { json, status } as unknown as Response;
    jest.clearAllMocks();
  });

  it("lists, creates, updates, and deletes views", async () => {
    service.listViews.mockResolvedValue([]);
    await SavedReportController.listViews(req, res);
    expect(service.listViews).toHaveBeenCalledWith("org-1");

    req.body = { name: "Summary", reportType: "summary", parameters: {} };
    service.createView.mockResolvedValue({ id: "view-1" } as never);
    await SavedReportController.createView(req, res);
    expect(status).toHaveBeenCalledWith(201);
    expect(service.createView).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "user-1" }),
    );

    req.body = { name: "Updated" };
    service.updateView.mockResolvedValue({ id: "view-1" } as never);
    await SavedReportController.updateView(req, res);
    expect(service.updateView).toHaveBeenCalledWith(
      expect.objectContaining({ viewId: "view-1" }),
    );

    service.deleteView.mockResolvedValue(undefined);
    await SavedReportController.deleteView(req, res);
    expect(status).toHaveBeenCalledWith(204);
  });

  it("lists, creates, updates, and deletes schedules", async () => {
    service.listSchedules.mockResolvedValue([]);
    await SavedReportController.listSchedules(req, res);
    expect(service.listSchedules).toHaveBeenCalledWith("org-1");

    req.body = {
      viewId: "d8ac067e-ccbb-4ec3-8abe-6e04468c0d83",
      recipients: ["user-2"],
      cronExpression: "0 9 * * 1",
      timezone: "UTC",
    };
    service.createSchedule.mockResolvedValue({ id: "schedule-1" } as never);
    await SavedReportController.createSchedule(req, res);
    expect(status).toHaveBeenCalledWith(201);

    req.body = { active: false };
    service.updateSchedule.mockResolvedValue({ id: "schedule-1" } as never);
    await SavedReportController.updateSchedule(req, res);
    expect(service.updateSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleId: "schedule-1", active: false }),
    );

    service.deleteSchedule.mockResolvedValue(undefined);
    await SavedReportController.deleteSchedule(req, res);
    expect(status).toHaveBeenCalledWith(204);
  });

  it("returns validation, service, and unexpected errors", async () => {
    req.body = { name: "" };
    await SavedReportController.createView(req, res);
    expect(status).toHaveBeenCalledWith(400);

    service.listViews.mockRejectedValueOnce(
      new SavedReportServiceError("missing", 404),
    );
    await SavedReportController.listViews(req, res);
    expect(status).toHaveBeenCalledWith(404);

    service.listSchedules.mockRejectedValueOnce(new Error("boom"));
    await SavedReportController.listSchedules(req, res);
    expect(status).toHaveBeenCalledWith(500);
  });

  it("requires the authenticated creator id", async () => {
    req.body = { name: "Summary", reportType: "summary", parameters: {} };
    delete (req as Request & { userId?: string }).userId;
    await SavedReportController.createView(req, res);
    expect(status).toHaveBeenCalledWith(401);
  });
});
