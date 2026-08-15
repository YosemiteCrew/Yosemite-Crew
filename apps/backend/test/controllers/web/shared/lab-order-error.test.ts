import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Response } from "express";
import { respondLabOrderServiceError } from "../../../../src/controllers/web/shared/lab-order-error";
import { LabOrderServiceError } from "../../../../src/services/lab-order.service";
import logger from "../../../../src/utils/logger";

jest.mock("../../../../src/utils/logger");

const mockedLogger = jest.mocked(logger);

describe("respondLabOrderServiceError", () => {
  let res: Response;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock, json: jsonMock } as unknown as Response;
    jest.clearAllMocks();
  });

  it("maps a LabOrderServiceError without code or details to a bare message", () => {
    const error = new LabOrderServiceError("Bad input.", 400);

    respondLabOrderServiceError(res, error, "log msg", "response msg");

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Bad input." });
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("includes the error code when present", () => {
    const error = new LabOrderServiceError("Missing mapping.", 400, "MAP_404");

    respondLabOrderServiceError(res, error, "log msg", "response msg");

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Missing mapping.",
      error: { code: "MAP_404" },
    });
  });

  it("includes details when present without a code", () => {
    const error = new LabOrderServiceError("Missing mapping.", 422, undefined, {
      provider: "IDEXX",
    });

    respondLabOrderServiceError(res, error, "log msg", "response msg");

    expect(statusMock).toHaveBeenCalledWith(422);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Missing mapping.",
      error: { details: { provider: "IDEXX" } },
    });
  });

  it("includes code and details together", () => {
    const error = new LabOrderServiceError("Missing mapping.", 400, "MAP_404", {
      field: "species",
    });

    respondLabOrderServiceError(res, error, "log msg", "response msg");

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Missing mapping.",
      error: { code: "MAP_404", details: { field: "species" } },
    });
  });

  it("logs and responds 500 for unknown errors", () => {
    const error = new Error("boom");

    respondLabOrderServiceError(res, error, "log msg", "response msg");

    expect(mockedLogger.error).toHaveBeenCalledWith("log msg", error);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ message: "response msg" });
  });
});
