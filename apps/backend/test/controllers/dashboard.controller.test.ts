import { DashboardController } from "src/controllers/web/dashboard.controller";
import {
  DashboardService,
  DashboardServiceError,
} from "src/services/dashboard.service";
import logger from "src/utils/logger";

jest.mock("src/services/dashboard.service", () => ({
  DashboardService: {
    getSummary: jest.fn(),
    getAppointmentsTrend: jest.fn(),
    getRevenueTrend: jest.fn(),
    getAppointmentLeaders: jest.fn(),
    getRevenueLeaders: jest.fn(),
    getInventoryTurnover: jest.fn(),
    getProductTurnover: jest.fn(),
  },
  DashboardServiceError: class MockDashboardServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockedService = DashboardService as unknown as Record<string, jest.Mock>;
const mockedLogger = logger as unknown as { error: jest.Mock };

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("DashboardController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns summary data", async () => {
    const req = {
      params: { organisationId: "org-1" },
      query: { range: "last_week" },
    } as any;
    const res = mockResponse();
    mockedService.getSummary.mockResolvedValueOnce({ revenue: 1 });

    await DashboardController.summary(req, res as any);

    expect(mockedService.getSummary).toHaveBeenCalledWith({
      organisationId: "org-1",
      range: "last_week",
    });
    expect(res.json).toHaveBeenCalledWith({ revenue: 1 });
  });

  it("handles service errors with status code", async () => {
    const req = {
      params: { organisationId: "org-1" },
      query: {},
    } as any;
    const res = mockResponse();
    mockedService.getSummary.mockRejectedValueOnce(
      new DashboardServiceError("bad", 422),
    );

    await DashboardController.summary(req, res as any);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ message: "bad" });
  });

  it("logs unexpected errors with 500", async () => {
    const req = { params: { organisationId: "org-1" }, query: {} } as any;
    const res = mockResponse();
    mockedService.getSummary.mockRejectedValueOnce(new Error("boom"));

    await DashboardController.summary(req, res as any);

    expect(mockedLogger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal Server Error",
    });
  });

  it("forwards product turnover query params", async () => {
    const req = {
      params: { organisationId: "org-1" },
      query: { year: "2024", limit: "3" },
    } as any;
    const res = mockResponse();
    mockedService.getProductTurnover.mockResolvedValueOnce([{ itemId: "i1" }]);

    await DashboardController.productTurnover(req, res as any);

    expect(mockedService.getProductTurnover).toHaveBeenCalledWith({
      organisationId: "org-1",
      year: 2024,
      limit: 3,
    });
    expect(res.json).toHaveBeenCalledWith([{ itemId: "i1" }]);
  });
});
