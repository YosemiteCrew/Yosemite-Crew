import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { ServiceController } from "../../../src/controllers/web/service.controller";
import {
  ServiceService,
  ServiceServiceError,
} from "../../../src/services/service.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/service.service", () => {
  const actual = jest.requireActual<
    typeof import("../../../src/services/service.service")
  >("../../../src/services/service.service");
  return {
    ...actual,
    ServiceService: {
      ...actual.ServiceService,
      create: jest.fn(),
      createMany: jest.fn(),
    },
  };
});
jest.mock("../../../src/utils/logger");

const mockedServiceService = jest.mocked(ServiceService);
const mockedLogger = jest.mocked(logger);

describe("ServiceController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = { body: {}, params: {} };
    res = { status: statusMock, json: jsonMock } as unknown as Response;

    jest.clearAllMocks();
  });

  describe("createService", () => {
    it("returns 400 when payload is not a FHIR HealthcareService", async () => {
      req.body = { resourceType: "Organization" };

      await ServiceController.createService(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Invalid"),
        }),
      );
      expect(mockedServiceService.create).not.toHaveBeenCalled();
    });
  });

  describe("createMany", () => {
    it("returns 400 when body is not an array", async () => {
      req.body = { resourceType: "HealthcareService" };

      await ServiceController.createMany(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockedServiceService.createMany).not.toHaveBeenCalled();
    });

    it("returns 400 when array contains non-HealthcareService items", async () => {
      req.body = [
        { resourceType: "HealthcareService" },
        { resourceType: "Organization" },
      ];

      await ServiceController.createMany(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockedServiceService.createMany).not.toHaveBeenCalled();
    });

    it("returns 201 with created services", async () => {
      req.body = [{ resourceType: "HealthcareService", id: "a" }];
      mockedServiceService.createMany.mockResolvedValue([
        { resourceType: "HealthcareService", id: "s1" } as any,
      ]);

      await ServiceController.createMany(req as any, res as Response);

      expect(mockedServiceService.createMany).toHaveBeenCalledWith(req.body);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith([
        expect.objectContaining({ id: "s1" }),
      ]);
    });

    it("maps ServiceServiceError to its status code", async () => {
      req.body = [{ resourceType: "HealthcareService" }];
      mockedServiceService.createMany.mockRejectedValue(
        new ServiceServiceError("Bad request", 400),
      );

      await ServiceController.createMany(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Bad request" });
    });

    it("falls back to 500 on unknown errors", async () => {
      req.body = [{ resourceType: "HealthcareService" }];
      mockedServiceService.createMany.mockRejectedValue("boom");

      await ServiceController.createMany(req as any, res as Response);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unable to create services.",
      });
    });
  });
});
