import { UserController } from "../../src/controllers/web/user.controller";
import { UserService, UserServiceError } from "../../src/services/user.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/user.service", () => {
  const actual = jest.requireActual("../../src/services/user.service");
  return {
    ...actual,
    UserService: {
      create: jest.fn(),
      getById: jest.fn(),
    },
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockedUserService = UserService as unknown as {
  create: jest.Mock;
  getById: jest.Mock;
};

const mockedLogger = logger as unknown as {
  error: jest.Mock;
};

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("UserController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("rejects invalid request body", async () => {
      const req = { body: null } as any;
      const res = createResponse();

      await UserController.create(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid request body." });
      expect(mockedUserService.create).not.toHaveBeenCalled();
    });

    it("creates user and returns 201", async () => {
      const req = { body: { id: "user-1", email: "user@example.com" } } as any;
      const res = createResponse();
      const createdUser = { id: "user-1", email: "user@example.com", isActive: true };
      mockedUserService.create.mockResolvedValueOnce(createdUser);

      await UserController.create(req, res as any);

      expect(mockedUserService.create).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdUser);
    });

    it("handles service validation errors with proper response", async () => {
      const req = { body: { id: "", email: "user@example.com" } } as any;
      const res = createResponse();
      mockedUserService.create.mockRejectedValueOnce(
        new UserServiceError("Validation failed.", 422)
      );

      await UserController.create(req, res as any);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "Validation failed." });
    });

    it("logs and returns 500 for unexpected errors", async () => {
      const req = { body: { id: "user-1", email: "user@example.com" } } as any;
      const res = createResponse();
      const error = new Error("Unexpected");
      mockedUserService.create.mockRejectedValueOnce(error);

      await UserController.create(req, res as any);

      expect(mockedLogger.error).toHaveBeenCalledWith("Failed to create user", error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Unable to create user." });
    });
  });

  describe("getById", () => {
    it("returns 200 when user found", async () => {
      const req = { params: { id: "user-1" } } as any;
      const res = createResponse();
      const user = { id: "user-1", email: "user@example.com", isActive: true };
      mockedUserService.getById.mockResolvedValueOnce(user);

      await UserController.getById(req, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(user);
    });

    it("returns 404 when user missing", async () => {
      const req = { params: { id: "missing" } } as any;
      const res = createResponse();
      mockedUserService.getById.mockResolvedValueOnce(null);

      await UserController.getById(req, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "User not found." });
    });

    it("maps service errors to HTTP responses", async () => {
      const req = { params: { id: "" } } as any;
      const res = createResponse();
      mockedUserService.getById.mockRejectedValueOnce(
        new UserServiceError("User id cannot be empty.", 400)
      );

      await UserController.getById(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "User id cannot be empty." });
    });

    it("logs unexpected errors and returns 500", async () => {
      const req = { params: { id: "user-1" } } as any;
      const res = createResponse();
      const error = new Error("db failure");
      mockedUserService.getById.mockRejectedValueOnce(error);

      await UserController.getById(req, res as any);

      expect(mockedLogger.error).toHaveBeenCalledWith("Failed to retrieve user", error);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Unable to retrieve user." });
    });
  });
});
