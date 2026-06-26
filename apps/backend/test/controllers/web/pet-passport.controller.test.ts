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
      issuePassport: jest.fn(),
      getPassport: jest.fn(),
      getPublicPassport: jest.fn(),
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
  const passportDto = {
    identity: { name: "Doggy" },
    vaccinations: [],
    parasiteTreatments: [],
    rabiesTitrations: [],
  };
  const authed = (extra: Record<string, unknown> = {}) =>
    ({
      params: orgParams,
      userPermissions: ["companions:view:any"],
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

  describe("issuePassport", () => {
    const body = { passportNumber: "GB-YC-1" };

    it("201s issuing a passport with the authed actor", async () => {
      service.issuePassport.mockResolvedValue({
        passportNumber: "GB-YC-1",
      } as never);
      await PetPassportController.issuePassport(
        authed({ body }),
        res as Response,
      );
      expect(service.issuePassport).toHaveBeenCalledWith(
        expect.objectContaining({ actor: { type: "PMS_USER", id: "user-1" } }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("500s without permissions", async () => {
      await PetPassportController.issuePassport(
        { params: orgParams, body } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("400s an invalid body and invalid route params", async () => {
      await PetPassportController.issuePassport(
        authed({ body: {} }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      await PetPassportController.issuePassport(
        authed({ params: { organisationId: "", patientId: "" }, body }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("defaults the actor id to null when the user id is absent", async () => {
      service.issuePassport.mockResolvedValue({} as never);
      await PetPassportController.issuePassport(
        authed({ body, userId: undefined }),
        res as Response,
      );
      expect(service.issuePassport).toHaveBeenCalledWith(
        expect.objectContaining({ actor: { type: "PMS_USER", id: null } }),
      );
    });

    it("maps a service error to its status, else 500", async () => {
      service.issuePassport.mockRejectedValue(
        new PetPassportServiceError("nope", 404),
      );
      await PetPassportController.issuePassport(
        authed({ body }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);

      service.issuePassport.mockRejectedValue(new Error("boom"));
      await PetPassportController.issuePassport(
        authed({ body }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getPassport", () => {
    it("200s the assembled passport", async () => {
      service.getPassport.mockResolvedValue(passportDto as never);
      await PetPassportController.getPassport(authed(), res as Response);
      expect(jsonMock).toHaveBeenCalledWith(passportDto);
    });

    it("500s without permissions and 400s bad params", async () => {
      await PetPassportController.getPassport(
        { params: orgParams } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      await PetPassportController.getPassport(
        authed({ params: { organisationId: "", patientId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("500s on an unexpected error", async () => {
      service.getPassport.mockRejectedValue(new Error("boom"));
      await PetPassportController.getPassport(authed(), res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getApplePass", () => {
    it("streams the signed pkpass with headers", async () => {
      service.getPassport.mockResolvedValue(passportDto as never);
      wallet.buildApplePass.mockResolvedValue(Buffer.from("pk") as never);
      await PetPassportController.getApplePass(authed(), res as Response);
      expect(setHeaderMock).toHaveBeenCalledWith(
        "Content-Type",
        "application/vnd.apple.pkpass",
      );
      expect(sendMock).toHaveBeenCalled();
    });

    it("500s without permissions and 400s bad params", async () => {
      await PetPassportController.getApplePass(
        { params: orgParams } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      await PetPassportController.getApplePass(
        authed({ params: { organisationId: "", patientId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("maps a wallet-not-configured error to its status", async () => {
      service.getPassport.mockResolvedValue(passportDto as never);
      wallet.buildApplePass.mockRejectedValue(
        new WalletNotConfiguredError("no creds", 501),
      );
      await PetPassportController.getApplePass(authed(), res as Response);
      expect(statusMock).toHaveBeenCalledWith(501);
    });

    it("falls back to a default filename for a nameless companion", async () => {
      service.getPassport.mockResolvedValue({
        ...passportDto,
        identity: { name: "" },
      } as never);
      wallet.buildApplePass.mockResolvedValue(Buffer.from("pk") as never);
      await PetPassportController.getApplePass(authed(), res as Response);
      expect(setHeaderMock).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="passport.pkpass"',
      );
    });
  });

  describe("getGooglePass", () => {
    it("200s the save url", async () => {
      service.getPassport.mockResolvedValue(passportDto as never);
      wallet.buildGoogleSaveUrl.mockReturnValue("https://pay.google.com/x");
      await PetPassportController.getGooglePass(authed(), res as Response);
      expect(jsonMock).toHaveBeenCalledWith({
        saveUrl: "https://pay.google.com/x",
      });
    });

    it("500s without permissions and 400s bad params", async () => {
      await PetPassportController.getGooglePass(
        { params: orgParams } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      await PetPassportController.getGooglePass(
        authed({ params: { organisationId: "", patientId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("500s on an unexpected error", async () => {
      service.getPassport.mockRejectedValue(new Error("boom"));
      await PetPassportController.getGooglePass(authed(), res as Response);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("getPublicPassport", () => {
    it("200s the public record", async () => {
      service.getPublicPassport.mockResolvedValue(passportDto as never);
      await PetPassportController.getPublicPassport(
        { params: { patientId: "pat-1" } } as unknown as Request,
        res as Response,
      );
      expect(jsonMock).toHaveBeenCalledWith(passportDto);
    });

    it("maps a service error to its status", async () => {
      service.getPublicPassport.mockRejectedValue(
        new PetPassportServiceError("bad", 400),
      );
      await PetPassportController.getPublicPassport(
        { params: { patientId: "pat-1" } } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("404s uniformly on an unexpected error and a missing id", async () => {
      service.getPublicPassport.mockRejectedValue(new Error("boom"));
      await PetPassportController.getPublicPassport(
        { params: {} } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });
});
