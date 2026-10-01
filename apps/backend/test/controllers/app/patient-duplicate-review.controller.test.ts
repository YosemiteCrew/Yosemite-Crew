import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "src/middlewares/auth";
import { PatientDuplicateReviewController } from "src/controllers/app/patient-duplicate-review.controller";
import {
  PatientDuplicateReviewError,
  PatientDuplicateReviewService,
} from "src/services/patient-duplicate-review.service";

jest.mock("src/services/patient-duplicate-review.service", () => {
  const actual = jest.requireActual(
    "src/services/patient-duplicate-review.service",
  );
  return {
    ...actual,
    PatientDuplicateReviewService: {
      list: jest.fn(),
      dismiss: jest.fn(),
    },
  };
});

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));

const mockedService = jest.mocked(PatientDuplicateReviewService);

describe("PatientDuplicateReviewController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let status: jest.Mock;
  let json: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    req = { params: {} };
    res = { status, json };
  });

  it("lists candidates for a validated practice", async () => {
    req.params = { organisationId: "practice-1" };
    mockedService.list.mockResolvedValue([]);

    await PatientDuplicateReviewController.list(
      req as Request,
      res as Response,
    );

    expect(mockedService.list).toHaveBeenCalledWith("practice-1");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ matches: [] });
  });

  it("rejects a missing practice id", async () => {
    await PatientDuplicateReviewController.list(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(mockedService.list).not.toHaveBeenCalled();
  });

  it("returns expected service errors without logging them as server faults", async () => {
    req.params = { organisationId: "practice-1" };
    mockedService.list.mockRejectedValue(
      new PatientDuplicateReviewError("Organisation is required.", 400),
    );

    await PatientDuplicateReviewController.list(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: "Organisation is required." });
  });

  it("records the authenticated staff member when dismissing a candidate", async () => {
    req.params = {
      organisationId: "practice-1",
      patientAId: "00000000-0000-4000-8000-000000000001",
      patientBId: "00000000-0000-4000-8000-000000000002",
    };
    (req as AuthenticatedRequest).userId = "staff-1";
    mockedService.dismiss.mockResolvedValue({ dismissedAt: new Date(0) });

    await PatientDuplicateReviewController.dismiss(
      req as Request,
      res as Response,
    );

    expect(mockedService.dismiss).toHaveBeenCalledWith({
      ...req.params,
      dismissedById: "staff-1",
    });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ dismissedAt: new Date(0) });
  });

  it("requires a staff session and valid patient ids before dismissing", async () => {
    req.params = {
      organisationId: "practice-1",
      patientAId: "not-a-uuid",
      patientBId: "00000000-0000-4000-8000-000000000002",
    };

    await PatientDuplicateReviewController.dismiss(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(mockedService.dismiss).not.toHaveBeenCalled();

    req.params.patientAId = "00000000-0000-4000-8000-000000000001";
    await PatientDuplicateReviewController.dismiss(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenLastCalledWith(401);
    expect(mockedService.dismiss).not.toHaveBeenCalled();
  });

  it("maps an unexpected dismissal failure to a safe server response", async () => {
    req.params = {
      organisationId: "practice-1",
      patientAId: "00000000-0000-4000-8000-000000000001",
      patientBId: "00000000-0000-4000-8000-000000000002",
    };
    (req as AuthenticatedRequest).userId = "staff-1";
    mockedService.dismiss.mockRejectedValue(new Error("internal"));

    await PatientDuplicateReviewController.dismiss(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      message: "Unable to review patient records.",
    });
  });
});
