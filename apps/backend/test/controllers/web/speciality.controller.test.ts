import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { SpecialityController } from "../../../src/controllers/web/speciality.controller";
import {
  SpecialityService,
  SpecialityServiceError,
} from "../../../src/services/speciality.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/speciality.service", () => {
  const actual = jest.requireActual<
    typeof import("../../../src/services/speciality.service")
  >("../../../src/services/speciality.service");
  return {
    ...actual,
    SpecialityService: {
      ...actual.SpecialityService,
      createMany: jest.fn(),
    },
  };
});
jest.mock("../../../src/utils/logger");

const mockedSpecialityService = jest.mocked(SpecialityService);
const mockedLogger = jest.mocked(logger);

describe("SpecialityController", () => {
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

  describe("createMany", () => {
    it("returns 400 when body is not an array", async () => {
      req.body = { resourceType: "Organization" };

      await SpecialityController.createMany(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Invalid"),
        }),
      );
      expect(mockedSpecialityService.createMany).not.toHaveBeenCalled();
    });

    it("returns 400 when any payload is not a FHIR Organization resource", async () => {
      req.body = [
        { resourceType: "Organization" },
        { resourceType: "Patient" },
      ];

      await SpecialityController.createMany(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockedSpecialityService.createMany).not.toHaveBeenCalled();
    });

    it("returns 201 and created resources", async () => {
      req.body = [{ resourceType: "Organization" }];
      mockedSpecialityService.createMany.mockResolvedValue([
        { resourceType: "Organization", id: "s1" } as any,
      ]);

      await SpecialityController.createMany(req as any, res as Response);

      expect(mockedSpecialityService.createMany).toHaveBeenCalledWith(req.body);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith([
        expect.objectContaining({ id: "s1" }),
      ]);
    });

    it("maps SpecialityServiceError to its status code", async () => {
      req.body = [{ resourceType: "Organization" }];
      mockedSpecialityService.createMany.mockRejectedValue(
        new SpecialityServiceError("Bad request", 400),
      );

      await SpecialityController.createMany(req as any, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Bad request" });
    });

    it("falls back to 500 on unknown errors", async () => {
      req.body = [{ resourceType: "Organization" }];
      mockedSpecialityService.createMany.mockRejectedValue("boom");

      await SpecialityController.createMany(req as any, res as Response);

      expect(mockedLogger.error).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Unable to create specialities.",
      });
    });
  });
});
