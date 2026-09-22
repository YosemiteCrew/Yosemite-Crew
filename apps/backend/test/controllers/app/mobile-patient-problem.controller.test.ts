const listProblemsForCompanion = jest.fn();
const loggerError = jest.fn();

jest.mock("src/services/mobile-patient-problem.service", () => ({
  MobilePatientProblemService: { listProblemsForCompanion },
}));

jest.mock("src/utils/logger", () => ({ error: loggerError, warn: jest.fn() }));

import type { Request, Response } from "express";
import { MobilePatientProblemController } from "src/controllers/app/patient-problem.controller";

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

const problem = {
  id: "prb-1",
  patientId: "pet-1",
  organisationId: "org-1",
  name: "Chronic kidney disease",
  status: "ACTIVE",
  severity: "SEVERE",
  recordedAt: "2026-03-05T09:00:00.000Z",
  updatedAt: "2026-03-05T09:00:00.000Z",
};

describe("MobilePatientProblemController.listForCompanion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listProblemsForCompanion.mockResolvedValue([]);
  });

  it("passes the path's patient id straight to the service", async () => {
    const res = response();

    await MobilePatientProblemController.listForCompanion(
      asReq({ patientId: "pet-7" }),
      asRes(res),
    );

    expect(listProblemsForCompanion).toHaveBeenCalledWith("pet-7");
  });

  it("answers 200 with the problems", async () => {
    listProblemsForCompanion.mockResolvedValue([problem]);
    const res = response();

    await MobilePatientProblemController.listForCompanion(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ problems: [problem] });
  });

  /*
   * "Nothing recorded" is an answer the owner needs, and a different answer
   * from "you cannot see this animal" - which the access middleware has
   * already given as a 404 before the handler runs.
   */
  it("answers 200 with an empty list rather than 404 when nothing is recorded", async () => {
    const res = response();

    await MobilePatientProblemController.listForCompanion(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ problems: [] });
  });

  it("answers 500 without leaking the failure to the caller", async () => {
    listProblemsForCompanion.mockRejectedValue(new Error("pool exhausted"));
    const res = response();

    await MobilePatientProblemController.listForCompanion(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to list companion problems.",
    });
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining("pool exhausted"),
    );
  });

  // A rejection that is not an Error still has to produce the same 500. The
  // logger line is built by a ternary, and its other arm is only reachable
  // this way.
  it("answers 500 when the rejection is not an Error", async () => {
    listProblemsForCompanion.mockRejectedValue("not an error object");
    const res = response();

    await MobilePatientProblemController.listForCompanion(asReq(), asRes(res));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining("Unknown error"),
    );
  });
});
