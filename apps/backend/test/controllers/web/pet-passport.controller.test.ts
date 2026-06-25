import { Request, Response } from "express";
import { PetPassportController } from "../../../src/controllers/web/pet-passport.controller";
import { PetPassportService } from "../../../src/services/pet-passport.service";
import { WalletPassService } from "../../../src/services/wallet-pass.service";

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
      recordParasiteTreatment: jest.fn(),
      listParasiteTreatments: jest.fn(),
      recordRabiesTitration: jest.fn(),
      listRabiesTitrations: jest.fn(),
      issuePassport: jest.fn(),
      getPassport: jest.fn(),
    },
  };
});
jest.mock("../../../src/services/wallet-pass.service", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual(
    "../../../src/services/wallet-pass.service",
  ) as any;
  return {
    ...actual,
    WalletPassService: {
      buildApplePass: jest.fn(),
      buildGoogleSaveUrl: jest.fn(),
    },
  };
});
jest.mock("../../../src/utils/logger");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PetPassportServiceError } = jest.requireActual(
  "../../../src/services/pet-passport.service",
) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { WalletNotConfiguredError } = jest.requireActual(
  "../../../src/services/wallet-pass.service",
) as any;

const service = jest.mocked(PetPassportService);
const wallet = jest.mocked(WalletPassService);

describe("PetPassportController", () => {
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;
  let setHeaderMock: jest.Mock;

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
    sendMock = jest.fn();
    setHeaderMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });
    res = { status: statusMock, setHeader: setHeaderMock } as Partial<Response>;
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

    it("defaults the actor id to null when the user id is absent", async () => {
      service.recordVaccination.mockResolvedValue({ id: "vac-1" } as never);
      await PetPassportController.recordVaccination(
        authed({ body: validBody, userId: undefined }),
        res as Response,
      );
      expect(service.recordVaccination).toHaveBeenCalledWith(
        expect.objectContaining({ actor: { type: "PMS_USER", id: null } }),
      );
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

  describe("getPassport", () => {
    it("200s with the assembled passport", async () => {
      service.getPassport.mockResolvedValue({
        identity: { name: "Doggy" },
      } as never);
      await PetPassportController.getPassport(authed(), res as Response);
      expect(service.getPassport).toHaveBeenCalledWith("pat-1", "org-1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("400s on invalid parameters", async () => {
      await PetPassportController.getPassport(
        authed({ params: { organisationId: "", patientId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("500s when permissions were not loaded", async () => {
      await PetPassportController.getPassport(
        { params: orgParams } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("maps a service error to its status code", async () => {
      service.getPassport.mockRejectedValue(
        new PetPassportServiceError("Companion not found.", 404),
      );
      await PetPassportController.getPassport(authed(), res as Response);
      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });

  describe("treatments and titrations", () => {
    const treatmentBody = {
      treatmentType: "ECHINOCOCCUS",
      productName: "Milbemax",
      treatedAt: "2024-06-20T14:00:00.000Z",
    };
    const titrationBody = {
      approvedLab: "EU Lab",
      sampleDate: "2024-05-01T00:00:00.000Z",
      resultIuMl: 0.8,
    };

    it("201s recording a parasite treatment", async () => {
      service.recordParasiteTreatment.mockResolvedValue({ id: "t1" } as never);
      await PetPassportController.recordParasiteTreatment(
        authed({ body: treatmentBody }),
        res as Response,
      );
      expect(service.recordParasiteTreatment).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: "pat-1",
          input: expect.objectContaining({ productName: "Milbemax" }),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("400s an invalid treatment body", async () => {
      await PetPassportController.recordParasiteTreatment(
        authed({ body: { treatmentType: "ECHINOCOCCUS" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(service.recordParasiteTreatment).not.toHaveBeenCalled();
    });

    it("500s a treatment record when permissions were not loaded", async () => {
      await PetPassportController.recordParasiteTreatment(
        { params: orgParams, body: treatmentBody } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("maps a treatment service error", async () => {
      service.recordParasiteTreatment.mockRejectedValue(
        new PetPassportServiceError("Companion not found.", 404),
      );
      await PetPassportController.recordParasiteTreatment(
        authed({ body: treatmentBody }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("400s and then 200s listing treatments", async () => {
      await PetPassportController.listParasiteTreatments(
        authed({ params: { organisationId: "", patientId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      service.listParasiteTreatments.mockResolvedValue([{ id: "t1" }] as never);
      await PetPassportController.listParasiteTreatments(
        authed(),
        res as Response,
      );
      expect(jsonMock).toHaveBeenCalledWith({ treatments: [{ id: "t1" }] });
    });

    it("500s treatment listing on an unexpected error", async () => {
      service.listParasiteTreatments.mockRejectedValue(new Error("boom"));
      await PetPassportController.listParasiteTreatments(
        authed(),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("201s recording a titration", async () => {
      service.recordRabiesTitration.mockResolvedValue({ id: "s1" } as never);
      await PetPassportController.recordRabiesTitration(
        authed({ body: titrationBody }),
        res as Response,
      );
      expect(service.recordRabiesTitration).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ approvedLab: "EU Lab" }),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("400s an invalid titration body", async () => {
      await PetPassportController.recordRabiesTitration(
        authed({ body: { approvedLab: "L" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("500s a titration record on an unexpected error", async () => {
      service.recordRabiesTitration.mockRejectedValue(new Error("boom"));
      await PetPassportController.recordRabiesTitration(
        authed({ body: titrationBody }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("500s and then 200s listing titrations", async () => {
      await PetPassportController.listRabiesTitrations(
        { params: orgParams } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      service.listRabiesTitrations.mockResolvedValue([{ id: "s1" }] as never);
      await PetPassportController.listRabiesTitrations(
        authed(),
        res as Response,
      );
      expect(jsonMock).toHaveBeenCalledWith({ titrations: [{ id: "s1" }] });
    });

    it("400s titration listing on invalid params", async () => {
      await PetPassportController.listRabiesTitrations(
        authed({ params: { organisationId: "", patientId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("defaults the actor id to null when the user id is absent", async () => {
      service.recordParasiteTreatment.mockResolvedValue({ id: "t1" } as never);
      service.recordRabiesTitration.mockResolvedValue({ id: "s1" } as never);
      await PetPassportController.recordParasiteTreatment(
        authed({ body: treatmentBody, userId: undefined }),
        res as Response,
      );
      expect(service.recordParasiteTreatment).toHaveBeenCalledWith(
        expect.objectContaining({ actor: { type: "PMS_USER", id: null } }),
      );
      await PetPassportController.recordRabiesTitration(
        authed({ body: titrationBody, userId: undefined }),
        res as Response,
      );
      expect(service.recordRabiesTitration).toHaveBeenCalledWith(
        expect.objectContaining({ actor: { type: "PMS_USER", id: null } }),
      );
    });

    it("400s a treatment record on invalid route params", async () => {
      await PetPassportController.recordParasiteTreatment(
        authed({
          params: { organisationId: "", patientId: "" },
          body: treatmentBody,
        }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("400s a titration record on invalid route params", async () => {
      await PetPassportController.recordRabiesTitration(
        authed({
          params: { organisationId: "", patientId: "" },
          body: titrationBody,
        }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("500s titration listing on an unexpected error", async () => {
      service.listRabiesTitrations.mockRejectedValue(new Error("boom"));
      await PetPassportController.listRabiesTitrations(
        authed(),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("issuePassport", () => {
    const issuanceBody = { passportNumber: "GB-YC-1" };

    it("201s issuing a passport", async () => {
      service.issuePassport.mockResolvedValue({
        passportNumber: "GB-YC-1",
      } as never);
      await PetPassportController.issuePassport(
        authed({ body: issuanceBody }),
        res as Response,
      );
      expect(service.issuePassport).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ passportNumber: "GB-YC-1" }),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("400s an invalid issuance body", async () => {
      await PetPassportController.issuePassport(
        authed({ body: {} }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(service.issuePassport).not.toHaveBeenCalled();
    });

    it("400s on invalid params", async () => {
      await PetPassportController.issuePassport(
        authed({
          params: { organisationId: "", patientId: "" },
          body: issuanceBody,
        }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("500s when permissions were not loaded", async () => {
      await PetPassportController.issuePassport(
        { params: orgParams, body: issuanceBody } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("maps a service error to its status code", async () => {
      service.issuePassport.mockRejectedValue(
        new PetPassportServiceError("Companion not found.", 404),
      );
      await PetPassportController.issuePassport(
        authed({ body: issuanceBody }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });

  describe("getApplePass", () => {
    const passport = { identity: { id: "pat-1", name: "Doggy" } } as never;

    it("500s when permissions were not loaded", async () => {
      await PetPassportController.getApplePass(
        { params: orgParams } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("400s on invalid route parameters", async () => {
      await PetPassportController.getApplePass(
        authed({ params: { organisationId: "", patientId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("streams a signed .pkpass with wallet headers", async () => {
      service.getPassport.mockResolvedValue(passport);
      const buffer = Buffer.from("PK-pass-bytes");
      wallet.buildApplePass.mockResolvedValue(buffer);

      await PetPassportController.getApplePass(authed(), res as Response);

      expect(setHeaderMock).toHaveBeenCalledWith(
        "Content-Type",
        "application/vnd.apple.pkpass",
      );
      expect(setHeaderMock).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="Doggy.pkpass"',
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith(buffer);
    });

    it("501s when wallet signing is not configured", async () => {
      service.getPassport.mockResolvedValue(passport);
      wallet.buildApplePass.mockRejectedValue(new WalletNotConfiguredError());
      await PetPassportController.getApplePass(authed(), res as Response);
      expect(statusMock).toHaveBeenCalledWith(501);
    });

    it("sanitises an awkward companion name into the filename", async () => {
      service.getPassport.mockResolvedValue({
        identity: { id: "pat-1", name: "Rex / O'Malley!" },
      } as never);
      wallet.buildApplePass.mockResolvedValue(Buffer.from("x"));
      await PetPassportController.getApplePass(authed(), res as Response);
      expect(setHeaderMock).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="Rex-O-Malley-.pkpass"',
      );
    });
  });

  describe("getGooglePass", () => {
    const passport = { identity: { id: "pat-1", name: "Doggy" } } as never;

    it("500s when permissions were not loaded", async () => {
      await PetPassportController.getGooglePass(
        { params: orgParams } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("400s on invalid route parameters", async () => {
      await PetPassportController.getGooglePass(
        authed({ params: { organisationId: "", patientId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns the add-to-wallet save url", async () => {
      service.getPassport.mockResolvedValue(passport);
      wallet.buildGoogleSaveUrl.mockReturnValue(
        "https://pay.google.com/gp/v/save/tok",
      );
      await PetPassportController.getGooglePass(authed(), res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        saveUrl: "https://pay.google.com/gp/v/save/tok",
      });
    });

    it("501s when wallet signing is not configured", async () => {
      service.getPassport.mockResolvedValue(passport);
      wallet.buildGoogleSaveUrl.mockImplementation(() => {
        throw new WalletNotConfiguredError("Google Wallet is not configured.");
      });
      await PetPassportController.getGooglePass(authed(), res as Response);
      expect(statusMock).toHaveBeenCalledWith(501);
    });
  });
});
