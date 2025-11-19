import { UserProfileController } from "../../src/controllers/web/user-profile.controller";
import {
  UserProfileService,
  UserProfileServiceError,
} from "../../src/services/user-profile.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/user-profile.service", () => {
  const actual = jest.requireActual("../../src/services/user-profile.service");
  return {
    ...actual,
    UserProfileService: {
      create: jest.fn(),
      update: jest.fn(),
      getByUserId: jest.fn(),
    },
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockedService = UserProfileService as unknown as {
  create: jest.Mock;
  update: jest.Mock;
  getByUserId: jest.Mock;
};

const mockedLogger = logger as unknown as {
  error: jest.Mock;
};

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("UserProfileController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("rejects invalid body", async () => {
      const req = { body: null } as any;
      const res = createResponse();

      await UserProfileController.create(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid request body.",
      });
      expect(mockedService.create).not.toHaveBeenCalled();
    });

    it("creates profile", async () => {
      const req = {
        body: {
          userId: "user-1",
          organizationId: "org-1",
          baseAvailability: [],
        },
      } as any;
      const res = createResponse();
      const profile = {
        _id: "profile-id",
        userId: "user-1",
        organizationId: "org-1",
      };
      mockedService.create.mockResolvedValueOnce(profile);

      await UserProfileController.create(req, res as any);

      expect(mockedService.create).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(profile);
    });

    it("maps service errors", async () => {
      const req = {
        body: {
          userId: "user-1",
          organizationId: "org-1",
          baseAvailability: [],
        },
      } as any;
      const res = createResponse();
      mockedService.create.mockRejectedValueOnce(
        new UserProfileServiceError("Validation", 422),
      );

      await UserProfileController.create(req, res as any);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "Validation" });
    });

    it("logs unexpected errors", async () => {
      const req = {
        body: {
          userId: "user-1",
          organizationId: "org-1",
          baseAvailability: [],
        },
      } as any;
      const res = createResponse();
      const error = new Error("boom");
      mockedService.create.mockRejectedValueOnce(error);

      await UserProfileController.create(req, res as any);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to create user profile",
        error,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to create user profile.",
      });
    });
  });

  describe("update", () => {
    it("updates profile", async () => {
      const req = {
        params: { userId: "user-1", organizationId: "org-1" },
        body: { baseAvailability: [] },
      } as any;
      const res = createResponse();
      const profile = {
        _id: "profile-id",
        userId: "user-1",
        organizationId: "org-1",
        status: "DRAFT",
      };
      mockedService.update.mockResolvedValueOnce(profile);

      await UserProfileController.update(req, res as any);

      expect(mockedService.update).toHaveBeenCalledWith(
        "user-1",
        "org-1",
        req.body,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(profile);
    });

    it("returns 404 when missing", async () => {
      const req = {
        params: { userId: "missing", organizationId: "org-1" },
        body: { baseAvailability: [] },
      } as any;
      const res = createResponse();
      mockedService.update.mockResolvedValueOnce(null);

      await UserProfileController.update(req, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User profile not found.",
      });
    });

    it("maps service errors", async () => {
      const req = {
        params: { userId: "user-1", organizationId: "org-1" },
        body: {},
      } as any;
      const res = createResponse();
      mockedService.update.mockRejectedValueOnce(
        new UserProfileServiceError("No fields", 400),
      );

      await UserProfileController.update(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "No fields" });
    });

    it("logs unexpected errors", async () => {
      const req = {
        params: { userId: "user-1", organizationId: "org-1" },
        body: { baseAvailability: [] },
      } as any;
      const res = createResponse();
      const error = new Error("db");
      mockedService.update.mockRejectedValueOnce(error);

      await UserProfileController.update(req, res as any);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to update user profile",
        error,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to update user profile.",
      });
    });
  });

  describe("getByUserId", () => {
    it("returns profile", async () => {
      const req = {
        params: { userId: "user-1", organizationId: "org-1" },
      } as any;
      const res = createResponse();
      const profile = {
        _id: "profile-id",
        userId: "user-1",
        organizationId: "org-1",
      };
      mockedService.getByUserId.mockResolvedValueOnce(profile);

      await UserProfileController.getByUserId(req, res as any);

      expect(mockedService.getByUserId).toHaveBeenCalledWith("user-1", "org-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(profile);
    });

    it("returns 404 when missing", async () => {
      const req = {
        params: { userId: "missing", organizationId: "org-1" },
      } as any;
      const res = createResponse();
      mockedService.getByUserId.mockResolvedValueOnce(null);

      await UserProfileController.getByUserId(req, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User profile not found.",
      });
    });

    it("maps service errors", async () => {
      const req = { params: { userId: "", organizationId: "" } } as any;
      const res = createResponse();
      mockedService.getByUserId.mockRejectedValueOnce(
        new UserProfileServiceError("Invalid", 400),
      );

      await UserProfileController.getByUserId(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid" });
    });

    it("logs unexpected errors", async () => {
      const req = {
        params: { userId: "user-1", organizationId: "org-1" },
      } as any;
      const res = createResponse();
      const error = new Error("db");
      mockedService.getByUserId.mockRejectedValueOnce(error);

      await UserProfileController.getByUserId(req, res as any);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to retrieve user profile",
        error,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unable to retrieve user profile.",
      });
    });
  });
});
