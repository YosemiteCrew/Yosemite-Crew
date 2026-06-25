import { Request, Response } from "express";
import { PetPassportController } from "../../../src/controllers/web/pet-passport.controller";
import { PetPassportService } from "../../../src/services/pet-passport.service";

jest.mock("../../../src/services/pet-passport.service", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual(
    "../../../src/services/pet-passport.service",
  ) as any;
  return {
    ...actual,
    PetPassportService: {
      recordVaccination: jest.fn(),
      listVaccinations: jest.fn(),
    },
  };
});
jest.mock("../../../src/utils/logger");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PetPassportServiceError } = jest.requireActual(
  "../../../src/services/pet-passport.service",
) as any;

const service = jest.mocked(PetPassportService);

describe("PetPassportController", () => {
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const orgParams = { organisationId: "org-1", patientId: "pat-1" };
  const validBody = {
    vaccineType: "RABIES",
    vaccineName: "Nobivac Rabies",
    dateAdministered: "2024-04-01T00:00:00.000Z",
  };
  const authed = (extra: Record<string, unknown> = {}) =>
    ({
      params: orgParams,
      userPermissions: ["vaccinations:edit:any"],
      userId: "user-1",
      ...extra,
    }) as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock } as Partial<Response>;
  });

  describe("recordVaccination", () => {
    it("500s when permissions were not loaded", async () => {
      await PetPassportController.recordVaccination(
        { params: orgParams, body: validBody } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("400s on invalid route parameters", async () => {
      await PetPassportController.recordVaccination(
        authed({ params: { organisationId: "", patientId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("400s on an invalid body and does not call the service", async () => {
      await PetPassportController.recordVaccination(
        authed({ body: { vaccineType: "RABIES" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(service.recordVaccination).not.toHaveBeenCalled();
    });

    it("201s with the created vaccination", async () => {
      service.recordVaccination.mockResolvedValue({ id: "vac-1" } as never);
      await PetPassportController.recordVaccination(
        authed({ body: validBody }),
        res as Response,
      );
      expect(service.recordVaccination).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: "pat-1",
          organisationId: "org-1",
          actor: { type: "PMS_USER", id: "user-1" },
          input: expect.objectContaining({ vaccineType: "RABIES" }),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("maps a service error to its status code", async () => {
      service.recordVaccination.mockRejectedValue(
        new PetPassportServiceError("Companion not found.", 404),
      );
      await PetPassportController.recordVaccination(
        authed({ body: validBody }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("500s on an unexpected error", async () => {
      service.recordVaccination.mockRejectedValue(new Error("boom"));
      await PetPassportController.recordVaccination(
        authed({ body: validBody }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listVaccinations", () => {
    it("200s with the vaccination list", async () => {
      service.listVaccinations.mockResolvedValue([{ id: "vac-1" }] as never);
      await PetPassportController.listVaccinations(authed(), res as Response);
      expect(service.listVaccinations).toHaveBeenCalledWith("pat-1", "org-1");
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        vaccinations: [{ id: "vac-1" }],
      });
    });

    it("400s on invalid parameters", async () => {
      await PetPassportController.listVaccinations(
        authed({ params: { organisationId: "", patientId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("500s when permissions were not loaded", async () => {
      await PetPassportController.listVaccinations(
        { params: orgParams } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("500s when the service throws while listing", async () => {
      service.listVaccinations.mockRejectedValue(new Error("boom"));
      await PetPassportController.listVaccinations(authed(), res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
