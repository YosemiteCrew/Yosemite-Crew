const listAllergiesForCompanion = jest.fn();
const loggerError = jest.fn();

jest.mock("src/services/mobile-patient-allergy.service", () => ({
  MobilePatientAllergyService: { listAllergiesForCompanion },
}));

jest.mock("src/utils/logger", () => ({ error: loggerError, warn: jest.fn() }));

import type { Request, Response } from "express";
import { MobilePatientAllergyController } from "src/controllers/app/patient-allergy.controller";

type MockResponse = { status: jest.Mock; json: jest.Mock };

const response = () => {
  const res = {} as MockResponse;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const asRes = (r: MockResponse) => r as unknown as Response;
const asReq = (params: Record<string, unknown> = { patientId: "pet-1" }) =>
  ({ params }) as unknown as Request;

const allergy = {
  id: "alg-1",
  patientId: "pet-1",
  organisationId: "org-1",
  allergen: "Penicillin",
  allergyType: "DRUG",
  severity: "LIFE_THREATENING",
  status: "ACTIVE",
  recordedAt: "2026-03-05T09:00:00.000Z",
  updatedAt: "2026-03-05T09:00:00.000Z",
};

describe("MobilePatientAllergyController.listForCompanion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listAllergiesForCompanion.mockResolvedValue([]);
  });

  it("passes the path's patient id straight to the service", async () => {
    const res = response();

    await MobilePatientAllergyController.listForCompanion(
      asReq({ patientId: "pet-7" }),
      asRes(res),
    );

    expect(listAllergiesForCompanion).toHaveBeenCalledWith("pet-7");
  });

  it("answers 200 with the allergies", async () => {
    listAllergiesForCompanion.mockResolvedValue([allergy]);
    const res = response();

    await MobilePatientAllergyController.listForCompanion(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ allergies: [allergy] });
  });

  /*
   * "Nothing recorded" is an answer the owner needs, and a different answer
   * from "you cannot see this animal" - which the access middleware has
   * already given as a 404 before the handler runs.
   */
  it("answers 200 with an empty list rather than 404 when nothing is recorded", async () => {
    const res = response();

    await MobilePatientAllergyController.listForCompanion(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ allergies: [] });
  });

  it("answers 500 without leaking the failure to the caller", async () => {
    listAllergiesForCompanion.mockRejectedValue(new Error("pool exhausted"));
    const res = response();

    await MobilePatientAllergyController.listForCompanion(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to list companion allergies.",
    });
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining("pool exhausted"),
    );
  });

  // A rejection that is not an Error still has to produce the same 500. The
  // logger line is built by a ternary, and its other arm is only reachable
  // this way.
  it("answers 500 when the rejection is not an Error", async () => {
    listAllergiesForCompanion.mockRejectedValue("not an error object");
    const res = response();

    await MobilePatientAllergyController.listForCompanion(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining("Unknown error"),
    );
  });
});
