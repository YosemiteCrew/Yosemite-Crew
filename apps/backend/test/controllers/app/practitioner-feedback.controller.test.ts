import type { Request, Response } from "express";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import {
  PractitionerFeedbackService,
  PractitionerFeedbackServiceError,
} from "src/services/practitioner-feedback.service";
import { PractitionerFeedbackController } from "src/controllers/app/practitioner-feedback.controller";
import { resolveVerifiedUserId } from "src/utils/request";
import logger from "src/utils/logger";

jest.mock("src/services/authUserMobile.service", () => ({
  AuthUserMobileService: { getByProviderUserId: jest.fn() },
}));

jest.mock("src/services/practitioner-feedback.service", () => ({
  PractitionerFeedbackService: {
    getForParent: jest.fn(),
    getForAppointment: jest.fn(),
    rateAppointment: jest.fn(),
  },
  PractitionerFeedbackServiceError: class extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  },
}));

jest.mock("src/utils/request", () => ({
  resolveVerifiedUserId: jest.fn(),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));

const makeRequest = (params: Record<string, string>, body?: unknown) =>
  ({ params, body }) as unknown as Request;

const makeResponse = () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return response as unknown as Response & typeof response;
};

describe("PractitionerFeedbackController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolveVerifiedUserId as jest.Mock).mockReturnValue("verified-user");
    (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({
      parentId: "parent-1",
    });
  });

  it("returns batch feedback for the verified parent", async () => {
    const response = makeResponse();
    const feedbackByAppointment = { "appointment-1": { isRated: false } };
    (PractitionerFeedbackService.getForParent as jest.Mock).mockResolvedValue(
      feedbackByAppointment,
    );

    await PractitionerFeedbackController.getForParent(
      makeRequest({}, {}),
      response,
    );

    expect(PractitionerFeedbackService.getForParent).toHaveBeenCalledWith(
      "parent-1",
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ feedbackByAppointment });
  });

  it("rejects batch lookups without a verified identity", async () => {
    (resolveVerifiedUserId as jest.Mock).mockReturnValue(null);
    const response = makeResponse();

    await PractitionerFeedbackController.getForParent(
      makeRequest({}, {}),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(PractitionerFeedbackService.getForParent).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied appointment filters for batch lookup", async () => {
    const response = makeResponse();

    await PractitionerFeedbackController.getForParent(
      makeRequest({}, { appointmentIds: ["another-parent-appointment"] }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(PractitionerFeedbackService.getForParent).not.toHaveBeenCalled();
  });

  it("returns existing feedback for the verified parent", async () => {
    const response = makeResponse();
    const feedback = { isRated: true, rating: 4, practitionerName: "Dr Lee" };
    (
      PractitionerFeedbackService.getForAppointment as jest.Mock
    ).mockResolvedValue(feedback);

    await PractitionerFeedbackController.getForAppointment(
      makeRequest({}, { appointmentId: "appointment-1" }),
      response,
    );

    expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith(
      "verified-user",
    );
    expect(PractitionerFeedbackService.getForAppointment).toHaveBeenCalledWith(
      "appointment-1",
      "parent-1",
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ feedback });
  });

  it("refuses requests without a verified identity", async () => {
    (resolveVerifiedUserId as jest.Mock).mockReturnValue(null);
    const response = makeResponse();

    await PractitionerFeedbackController.getForAppointment(
      makeRequest({}, { appointmentId: "appointment-1" }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(
      PractitionerFeedbackService.getForAppointment,
    ).not.toHaveBeenCalled();
  });

  it("refuses users without a linked parent", async () => {
    (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({
      parentId: null,
    });
    const response = makeResponse();

    await PractitionerFeedbackController.getForAppointment(
      makeRequest({}, { appointmentId: "appointment-1" }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(
      PractitionerFeedbackService.getForAppointment,
    ).not.toHaveBeenCalled();
  });

  it("validates ratings and rejects caller-supplied provider identifiers", async () => {
    const response = makeResponse();

    await PractitionerFeedbackController.rateAppointment(
      makeRequest(
        { appointmentId: "appointment-1" },
        { rating: 5, practitionerId: "another-provider" },
      ),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(PractitionerFeedbackService.rateAppointment).not.toHaveBeenCalled();
  });

  it("saves validated feedback against the appointment and parent only", async () => {
    const response = makeResponse();
    (
      PractitionerFeedbackService.rateAppointment as jest.Mock
    ).mockResolvedValue({
      success: true,
    });

    await PractitionerFeedbackController.rateAppointment(
      makeRequest(
        { appointmentId: "appointment-1" },
        { rating: 5, review: "Good care" },
      ),
      response,
    );

    expect(PractitionerFeedbackService.rateAppointment).toHaveBeenCalledWith(
      "appointment-1",
      "parent-1",
      5,
      "Good care",
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ message: "Feedback saved." });
  });

  it("refuses saves when the verified user has no linked parent", async () => {
    (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({
      parentId: null,
    });
    const response = makeResponse();

    await PractitionerFeedbackController.rateAppointment(
      makeRequest({ appointmentId: "appointment-1" }, { rating: 5 }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(PractitionerFeedbackService.rateAppointment).not.toHaveBeenCalled();
  });

  it("preserves service validation errors", async () => {
    const response = makeResponse();
    (
      PractitionerFeedbackService.rateAppointment as jest.Mock
    ).mockRejectedValue(
      new PractitionerFeedbackServiceError(
        "Feedback is not available yet.",
        409,
      ),
    );

    await PractitionerFeedbackController.rateAppointment(
      makeRequest({ appointmentId: "appointment-1" }, { rating: 5 }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      message: "Feedback is not available yet.",
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns a safe server error when loading fails unexpectedly", async () => {
    const response = makeResponse();
    (
      PractitionerFeedbackService.getForAppointment as jest.Mock
    ).mockRejectedValue(new Error("database detail"));

    await PractitionerFeedbackController.getForAppointment(
      makeRequest({}, { appointmentId: "appointment-1" }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      message: "Unable to load feedback.",
    });
  });

  it("rejects malformed feedback lookups", async () => {
    const response = makeResponse();

    await PractitionerFeedbackController.getForAppointment(
      makeRequest({}, { appointmentId: "" }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(
      PractitionerFeedbackService.getForAppointment,
    ).not.toHaveBeenCalled();
  });

  it("returns a safe server error when saving fails unexpectedly", async () => {
    const response = makeResponse();
    (
      PractitionerFeedbackService.rateAppointment as jest.Mock
    ).mockRejectedValue(
      Object.assign(new Error("database detail"), {
        meta: { review: "Private review text" },
      }),
    );

    await PractitionerFeedbackController.rateAppointment(
      makeRequest(
        { appointmentId: "appointment-1" },
        { rating: 5, review: "Private review text" },
      ),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      message: "Unable to save feedback.",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "Unable to save practitioner feedback",
      { error: { kind: "error", name: "Error", message: "database detail" } },
    );
    expect(
      JSON.stringify((logger.error as jest.Mock).mock.calls),
    ).not.toContain("Private review text");
  });
});
