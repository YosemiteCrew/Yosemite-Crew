import { ServiceController } from "../../src/controllers/web/service.controller";
import { ServiceService, ServiceServiceError } from "../../src/services/service.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/service.service", () => {
  const actual = jest.requireActual("../../src/services/service.service");
  return {
    ...actual,
    ServiceService: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getById: jest.fn(),
      listBySpeciality: jest.fn(),
      listOrganisationsProvidingService: jest.fn(),
    },
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockedService = ServiceService as unknown as {
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  getById: jest.Mock;
  listBySpeciality: jest.Mock;
  listOrganisationsProvidingService: jest.Mock;
};

const mockedLogger = logger as unknown as { error: jest.Mock };

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

describe("ServiceController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates service", async () => {
    const req = { body: { resourceType: "HealthcareService" } } as any;
    const res = mockResponse();
    mockedService.create.mockResolvedValueOnce({ id: "svc-1" });

    await ServiceController.createService(req, res as any);

    expect(mockedService.create).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: "svc-1" });
  });

  it("handles service error on create", async () => {
    const req = { body: {} } as any;
    const res = mockResponse();
    mockedService.create.mockRejectedValueOnce(
      new ServiceServiceError("bad", 400),
    );

    await ServiceController.createService(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "bad" });
  });

  it("logs unexpected error on create", async () => {
    const req = { body: {} } as any;
    const res = mockResponse();
    const error = new Error("boom");
    mockedService.create.mockRejectedValueOnce(error);

    await ServiceController.createService(req, res as any);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Failed to create service",
      error,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("returns 404 when service not found", async () => {
    const req = { params: { id: "missing" } } as any;
    const res = mockResponse();
    mockedService.getById.mockResolvedValueOnce(null);

    await ServiceController.getServiceById(req, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Service not found." });
  });

  it("updates service", async () => {
    const req = { params: { id: "svc-1" }, body: {} } as any;
    const res = mockResponse();
    mockedService.update.mockResolvedValueOnce({ id: "svc-1", name: "New" });

    await ServiceController.updateService(req, res as any);

    expect(mockedService.update).toHaveBeenCalledWith("svc-1", req.body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: "svc-1", name: "New" });
  });

  it("validates serviceName query", async () => {
    const req = { query: {} } as any;
    const res = mockResponse();

    await ServiceController.listOrganisationByServiceName(req, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Query paramter serviceName is reqired.",
    });
    expect(mockedService.listOrganisationsProvidingService).not.toHaveBeenCalled();
  });
});
