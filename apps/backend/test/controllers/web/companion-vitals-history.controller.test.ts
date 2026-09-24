import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Response } from "express";
import { CompanionHistoryController } from "../../../src/controllers/web/companion-history.controller";
import { CompanionHistoryServiceError } from "../../../src/services/companion-history.service";
import { PatientVitalsHistoryService } from "../../../src/services/patient-vitals-history.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/companion-history.service", () => {
  class MockCompanionHistoryServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = "CompanionHistoryServiceError";
    }
  }
  return {
    __esModule: true,
    CompanionHistoryServiceError: MockCompanionHistoryServiceError,
    CompanionHistoryService: { listForCompanion: jest.fn() },
  };
});
jest.mock("../../../src/services/patient-vitals-history.service", () => ({
  PatientVitalsHistoryService: { listForPatient: jest.fn() },
}));
jest.mock("../../../src/utils/logger");

const listForPatient = jest.mocked(PatientVitalsHistoryService.listForPatient);

describe("CompanionHistoryController.listVitalsForCompanion", () => {
  const organisationId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const patientId = "bbbbbbbbbbbbbbbbbbbbbbbb";
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let res: Response;

  const request = (overrides: Record<string, unknown> = {}) =>
    ({
      params: { organisationId, patientId },
      query: {},
      userPermissions: ["companions:view:any", "forms:view:any"],
      ...overrides,
    }) as any;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock, json: jsonMock } as unknown as Response;
    listForPatient.mockReset();
    jest.mocked(logger.error).mockReset();
  });

  it("returns the history with the default limit and no inpatient rows without appointment access", async () => {
    listForPatient.mockResolvedValue({ entries: [], truncated: false });

    await CompanionHistoryController.listVitalsForCompanion(request(), res);

    expect(listForPatient).toHaveBeenCalledWith({
      organisationId,
      patientId,
      limit: 200,
      includeInpatient: false,
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ entries: [], truncated: false });
  });

  it("includes inpatient rows and honours the limit when the caller may see appointments", async () => {
    listForPatient.mockResolvedValue({ entries: [], truncated: true });

    await CompanionHistoryController.listVitalsForCompanion(
      request({
        query: { limit: "25" },
        userPermissions: ["forms:view:any", "appointments:view:any"],
      }),
      res,
    );

    expect(listForPatient).toHaveBeenCalledWith({
      organisationId,
      patientId,
      limit: 25,
      includeInpatient: true,
    });
  });

  it.each([["0"], ["501"], ["abc"]])("rejects limit %s", async (limit) => {
    await CompanionHistoryController.listVitalsForCompanion(
      request({ query: { limit } }),
      res,
    );
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Invalid query parameters",
    });
    expect(listForPatient).not.toHaveBeenCalled();
  });

  it("rejects an invalid patient id", async () => {
    await CompanionHistoryController.listVitalsForCompanion(
      request({ params: { organisationId, patientId: "nope" } }),
      res,
    );
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(listForPatient).not.toHaveBeenCalled();
  });

  it("returns 500 when permissions were not loaded", async () => {
    await CompanionHistoryController.listVitalsForCompanion(
      request({ userPermissions: undefined }),
      res,
    );
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(listForPatient).not.toHaveBeenCalled();
  });

  it("maps a service error to its status", async () => {
    listForPatient.mockRejectedValue(
      new CompanionHistoryServiceError("Companion not found", 404),
    );

    await CompanionHistoryController.listVitalsForCompanion(request(), res);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Companion not found" });
  });

  it("logs and returns 500 on an unexpected failure", async () => {
    listForPatient.mockRejectedValue(new Error("db down"));

    await CompanionHistoryController.listVitalsForCompanion(request(), res);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledWith(
      "Companion vitals history retrieval failed",
      expect.any(Error),
    );
  });
});
