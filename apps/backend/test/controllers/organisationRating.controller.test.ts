import { Request, Response } from "express";
import { OrganisationRatingController } from "../../src/controllers/app/organisationRating.controller";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { OrganizationRatingService } from "../../src/services/organisationReting.service";
import logger from "../../src/utils/logger";

// --- MOCKS ---
jest.mock("../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../src/services/organisationReting.service", () => ({
  OrganizationRatingService: {
    rateOrganisation: jest.fn(),
    isUserRatedOrganisation: jest.fn(),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  error: jest.fn(),
}));

// --- TEST UTILS ---
const mockRequest = (overrides = {}) =>
  ({
    headers: {},
    params: {},
    body: {},
    ...overrides,
  }) as unknown as Request;

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe("OrganisationRatingController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rateOrganisation", () => {
    it("should return 400 if rating is missing in the body", async () => {
      const req = mockRequest({
        headers: { "x-user-id": "auth-123" },
        body: { review: "Good place" }, // missing rating
      });
      const res = mockResponse();

      await OrganisationRatingController.rateOrganisation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Rating is required." });
      expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith(
        "auth-123",
      );
    });

    it("should return 400 if parentId is not found for the user", async () => {
      const req = mockRequest({
        headers: { "x-user-id": "auth-123" },
        params: { organisationId: "org-123" },
        body: { rating: 5 },
      });
      const res = mockResponse();

      // Mock user found but no parentId
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({
        _id: "user-obj-id",
        parentId: null,
      });

      await OrganisationRatingController.rateOrganisation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Parent not found for user.",
      });
    });

    it("should successfully submit rating when using x-user-id header", async () => {
      const req = mockRequest({
        headers: { "x-user-id": "auth-123" },
        params: { organisationId: "org-123" },
        body: { rating: 4, review: "Great service" },
      });
      const res = mockResponse();

      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({
        parentId: "parent-123",
      });
      (
        OrganizationRatingService.rateOrganisation as jest.Mock
      ).mockResolvedValue(undefined);

      await OrganisationRatingController.rateOrganisation(req, res);

      expect(OrganizationRatingService.rateOrganisation).toHaveBeenCalledWith(
        "org-123",
        "parent-123",
        4,
        "Great service",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Rating submitted successfully.",
      });
    });

    it("should resolve user from req.userId fallback when header is missing or an array", async () => {
      const req = mockRequest({
        headers: { "x-user-id": ["array-value"] }, // Forces the fallback branch
        userId: "fallback-auth-123", // Extracted via AuthenticatedRequest cast
        params: { organisationId: "org-123" },
        body: { rating: 5 },
      });
      const res = mockResponse();

      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({
        parentId: "parent-123",
      });

      await OrganisationRatingController.rateOrganisation(req, res);

      expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith(
        "fallback-auth-123",
      );
      expect(OrganizationRatingService.rateOrganisation).toHaveBeenCalledWith(
        "org-123",
        "parent-123",
        5,
        undefined,
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should catch errors, log them, and return 500", async () => {
      const req = mockRequest({
        headers: { "x-user-id": "auth-123" },
        params: { organisationId: "org-123" },
        body: { rating: 5 },
      });
      const res = mockResponse();

      const testError = new Error("DB crash");
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockRejectedValue(testError);

      await OrganisationRatingController.rateOrganisation(req, res);

      expect(logger.error).toHaveBeenCalledWith(
        "Error while rating an organisation: ",
        testError,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Unable to rate." });
    });
  });

  describe("isUserRatedOrganisation", () => {
    it("should return 400 if parentId is not found for the user", async () => {
      const req = mockRequest({
        headers: { "x-user-id": "auth-123" },
        params: { organisationId: "org-123" },
      });
      const res = mockResponse();

      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue(null);

      await OrganisationRatingController.isUserRatedOrganisation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Parent not found for user.",
      });
    });

    it("should return 200 with hasRated true if user has rated", async () => {
      const req = mockRequest({
        headers: { "x-user-id": "auth-123" },
        params: { organisationId: "org-123" },
      });
      const res = mockResponse();

      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({
        parentId: "parent-123",
      });
      (
        OrganizationRatingService.isUserRatedOrganisation as jest.Mock
      ).mockResolvedValue(true);

      await OrganisationRatingController.isUserRatedOrganisation(req, res);

      expect(
        OrganizationRatingService.isUserRatedOrganisation,
      ).toHaveBeenCalledWith("org-123", "parent-123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ hasRated: true });
    });

    it("should return 200 with hasRated false if user has not rated", async () => {
      const req = mockRequest({
        headers: { "x-user-id": "auth-123" },
        params: { organisationId: "org-123" },
      });
      const res = mockResponse();

      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({
        parentId: "parent-123",
      });
      (
        OrganizationRatingService.isUserRatedOrganisation as jest.Mock
      ).mockResolvedValue(false);

      await OrganisationRatingController.isUserRatedOrganisation(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ hasRated: false });
    });

    it("should catch errors, log them, and return 500", async () => {
      const req = mockRequest({
        headers: { "x-user-id": "auth-123" },
        params: { organisationId: "org-123" },
      });
      const res = mockResponse();

      const testError = new Error("Network error");
      (
        AuthUserMobileService.getByProviderUserId as jest.Mock
      ).mockResolvedValue({
        parentId: "parent-123",
      });
      (
        OrganizationRatingService.isUserRatedOrganisation as jest.Mock
      ).mockRejectedValue(testError);

      await OrganisationRatingController.isUserRatedOrganisation(req, res);

      expect(logger.error).toHaveBeenCalledWith(
        "Error while checking if user has rated an organisation: ",
        testError,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to check rating status.",
      });
    });
  });
});
