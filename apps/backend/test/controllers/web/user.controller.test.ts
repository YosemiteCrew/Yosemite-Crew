// 1. Set AWS Region immediately
process.env.AWS_REGION = "us-east-1";

import { Request, Response } from "express";
import { UserController } from "../../../src/controllers/web/user.controller";
// 2. Import UserService (for type) but we will use the mock implementation
import { UserService, UserServiceError } from "../../../src/services/user.service";
import logger from "../../../src/utils/logger";

// --- Mocks ---
jest.mock("../../../src/utils/logger");
jest.mock("../../../src/services/cognito.service");

// 3. Fix: Partially mock user.service to keep the Error class real
jest.mock("../../../src/services/user.service", () => {
  const actual = jest.requireActual("../../../src/services/user.service");
  return {
    ...actual,
    UserService: {
      create: jest.fn(),
      getById: jest.fn(),
      deleteById: jest.fn(),
      updateName: jest.fn(),
    },
  };
});

// --- Helper Types & Factory ---
type MockResponse = Partial<Response> & {
  status: jest.Mock;
  json: jest.Mock;
};

// Generic mock request factory
const createMockReq = (data: Partial<any> = {}): any =>
  ({
    params: {},
    body: {},
    ...data,
  });

const createMockRes = (): MockResponse => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("UserController", () => {
  let mockRes: MockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = createMockRes();
  });

  describe("create", () => {
    const validAuthReq = {
      userId: "user-123",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
    };

    it("should return 201 and created user on success", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      (UserService.create as jest.Mock).mockResolvedValue(mockUser);

      const req = createMockReq(validAuthReq);
      await UserController.create(req, mockRes as Response);

      expect(UserService.create).toHaveBeenCalledWith({
        id: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockUser);
    });

    it("should return 400 if userId or email is missing", async () => {
      const req = createMockReq({ userId: "", email: "" });
      await UserController.create(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Missing user identity from token.",
      });
      expect(UserService.create).not.toHaveBeenCalled();
    });

    it("should return specific status code if UserServiceError is thrown", async () => {
      // Now using the real class which the controller also uses
      (UserService.create as jest.Mock).mockRejectedValue(
        new UserServiceError("Conflict", 409)
      );

      const req = createMockReq(validAuthReq);
      await UserController.create(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Conflict" });
    });

    it("should return 500 and log error on generic exception", async () => {
      const error = new Error("Database Fail");
      (UserService.create as jest.Mock).mockRejectedValue(error);

      const req = createMockReq(validAuthReq);
      await UserController.create(req, mockRes as Response);

      expect(logger.error).toHaveBeenCalledWith("Failed to create user", error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unable to create user.",
      });
    });
  });

  describe("getById", () => {
    it("should return 200 and user if found", async () => {
      const mockUser = { id: "123", name: "Test" };
      (UserService.getById as jest.Mock).mockResolvedValue(mockUser);

      const req = createMockReq({ params: { id: "123" } });
      await UserController.getById(req, mockRes as Response);

      expect(UserService.getById).toHaveBeenCalledWith("123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockUser);
    });

    it("should return 404 if user not found", async () => {
      (UserService.getById as jest.Mock).mockResolvedValue(null);

      const req = createMockReq({ params: { id: "999" } });
      await UserController.getById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "User not found." });
    });

    it("should handle UserServiceError", async () => {
      (UserService.getById as jest.Mock).mockRejectedValue(
        new UserServiceError("Bad Request", 400)
      );

      const req = createMockReq({ params: { id: "123" } });
      await UserController.getById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Bad Request" });
    });

    it("should handle generic errors", async () => {
      const error = new Error("DB Error");
      (UserService.getById as jest.Mock).mockRejectedValue(error);

      const req = createMockReq({ params: { id: "123" } });
      await UserController.getById(req, mockRes as Response);

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to retrieve user",
        error
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteById", () => {
    it("should return 200 if deletion successful", async () => {
      (UserService.deleteById as jest.Mock).mockResolvedValue(true);

      const req = createMockReq({ params: { id: "123" } });
      await UserController.deleteById(req, mockRes as Response);

      expect(UserService.deleteById).toHaveBeenCalledWith("123");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "User deleted successfully.",
      });
    });

    it("should return 400 if id param is missing", async () => {
      const req = createMockReq({ params: { id: "" } });
      await UserController.deleteById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "User id is required.",
      });
      expect(UserService.deleteById).not.toHaveBeenCalled();
    });

    it("should return 404 if user not found (delete returned false)", async () => {
      (UserService.deleteById as jest.Mock).mockResolvedValue(false);

      const req = createMockReq({ params: { id: "123" } });
      await UserController.deleteById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "User not found." });
    });

    it("should handle UserServiceError", async () => {
      (UserService.deleteById as jest.Mock).mockRejectedValue(
        new UserServiceError("Forbidden", 403)
      );

      const req = createMockReq({ params: { id: "123" } });
      await UserController.deleteById(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it("should handle generic errors", async () => {
      const error = new Error("Fail");
      (UserService.deleteById as jest.Mock).mockRejectedValue(error);

      const req = createMockReq({ params: { id: "123" } });
      await UserController.deleteById(req, mockRes as Response);

      expect(logger.error).toHaveBeenCalledWith("Failed to delete user", error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("updateName", () => {
    it("should return 200 and updated user on success", async () => {
      const mockUpdated = { firstName: "John", lastName: "Smith" };
      (UserService.updateName as jest.Mock).mockResolvedValue(mockUpdated);

      const req = createMockReq({
        userId: "user-123",
        body: { firstName: "John", lastName: "Smith" },
      });
      await UserController.updateName(req, mockRes as Response);

      expect(UserService.updateName).toHaveBeenCalledWith({
        userId: "user-123",
        firstName: "John",
        lastName: "Smith",
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockUpdated);
    });

    it("should return 401 if userId is missing from auth context", async () => {
      const req = createMockReq({
        userId: undefined,
        body: { firstName: "John", lastName: "Smith" },
      });
      await UserController.updateName(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Missing user identity from token.",
      });
    });

    it("should return 400 if firstName or lastName is missing", async () => {
      const req = createMockReq({
        userId: "user-123",
        body: { firstName: "" },
      });
      await UserController.updateName(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "First name and last name are required.",
      });
    });

    it("should handle UserServiceError", async () => {
      (UserService.updateName as jest.Mock).mockRejectedValue(
        new UserServiceError("Validation Error", 422)
      );

      const req = createMockReq({
        userId: "user-123",
        body: { firstName: "A", lastName: "B" },
      });
      await UserController.updateName(req, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(422);
    });

    it("should handle generic errors", async () => {
      const error = new Error("DB Error");
      (UserService.updateName as jest.Mock).mockRejectedValue(error);

      const req = createMockReq({
        userId: "user-123",
        body: { firstName: "A", lastName: "B" },
      });
      await UserController.updateName(req, mockRes as Response);

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to update user name",
        error
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});