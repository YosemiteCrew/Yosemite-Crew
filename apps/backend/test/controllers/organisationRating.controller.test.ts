import { OrganisationRatingController } from "../../src/controllers/app/organisationRating.controller";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { OrganizationRatingService } from "src/services/organisationReting.service";
import logger from "src/utils/logger";

jest.mock("src/services/authUserMobile.service", () => ({
  __esModule: true,
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("src/services/organisationReting.service", () => ({
  __esModule: true,
  OrganizationRatingService: {
    rateOrganisation: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockedAuth = AuthUserMobileService as unknown as {
  getByProviderUserId: jest.Mock;
};

const mockedRatingService = OrganizationRatingService as unknown as {
  rateOrganisation: jest.Mock;
};

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("OrganisationRatingController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("submits rating when parent is found", async () => {
    const req = {
      headers: { "x-user-id": "user-123" },
      params: { organisationId: "org-1" },
      body: { rating: 4, review: "great" },
    } as any;
    const res = mockResponse();
    mockedAuth.getByProviderUserId.mockResolvedValueOnce({
      parentId: "507f1f77bcf86cd799439011",
    });

    await OrganisationRatingController.rateOrganisation(req, res as any);

    expect(mockedAuth.getByProviderUserId).toHaveBeenCalledWith("user-123");
    expect(mockedRatingService.rateOrganisation).toHaveBeenCalledWith(
      "org-1",
      "507f1f77bcf86cd799439011",
      4,
      "great",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rating submitted successfully.",
    });
  });

  it("returns 400 when parent not found on user", async () => {
    const req = {
      headers: { "x-user-id": "user-123" },
      params: { organisationId: "org-1" },
      body: { rating: 4 },
    } as any;
    const res = mockResponse();
    mockedAuth.getByProviderUserId.mockResolvedValueOnce({});

    await OrganisationRatingController.rateOrganisation(req, res as any);

    expect(mockedRatingService.rateOrganisation).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Parent not found for user.",
    });
  });
});
