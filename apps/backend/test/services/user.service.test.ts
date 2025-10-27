import type { UserDocument } from "../../src/models/user";
import UserModel from "../../src/models/user";
import { UserService } from "../../src/services/user.service";

jest.mock("../../src/models/user", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const mockedUserModel = UserModel as unknown as {
  findOne: jest.Mock;
  create: jest.Mock;
};

describe("UserService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("create", () => {
    it("persists a sanitized user when no duplicate exists", async () => {
      mockedUserModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const createdDocument = {
        userId: "user-1",
        email: "test@example.com",
        isActive: false,
      } as unknown as UserDocument;
      mockedUserModel.create.mockResolvedValueOnce(createdDocument);

      const result = await UserService.create({
        id: " user-1 ",
        email: "Test@Example.com ",
        isActive: false,
      });

      expect(mockedUserModel.findOne).toHaveBeenNthCalledWith(1, { userId: "user-1" }, null, {
        sanitizeFilter: true,
      });
      expect(mockedUserModel.findOne).toHaveBeenNthCalledWith(2, { email: "test@example.com" }, null, {
        sanitizeFilter: true,
      });
      expect(mockedUserModel.create).toHaveBeenCalledWith({
        userId: "user-1",
        email: "test@example.com",
        isActive: false,
      });
      expect(result).toEqual({
        id: "user-1",
        email: "test@example.com",
        isActive: false,
      });
    });

    it("defaults isActive to true when not provided", async () => {
      mockedUserModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const createdDocument = {
        userId: "user-2",
        email: "user2@example.com",
        isActive: true,
      } as unknown as UserDocument;
      mockedUserModel.create.mockResolvedValueOnce(createdDocument);

      await UserService.create({
        id: "user-2",
        email: "user2@example.com",
      });

      expect(mockedUserModel.create).toHaveBeenCalledWith({
        userId: "user-2",
        email: "user2@example.com",
        isActive: true,
      });
    });

    it("throws when email is invalid", async () => {
      await expect(
        UserService.create({ id: "user-3", email: "not-an-email" })
      ).rejects.toMatchObject({
        message: "Invalid email address.",
        statusCode: 400,
      });
    });

    it("throws when duplicate user exists", async () => {
      mockedUserModel.findOne.mockResolvedValueOnce({} as UserDocument);

      await expect(
        UserService.create({ id: "user-1", email: "user@example.com" })
      ).rejects.toMatchObject({
        message: "User with the same id or email already exists.",
        statusCode: 409,
      });
    });
  });

  describe("getById", () => {
    it("returns null when no document found", async () => {
      mockedUserModel.findOne.mockResolvedValueOnce(null);

      const result = await UserService.getById("missing");

      expect(result).toBeNull();
    });

    it("returns domain user when document exists", async () => {
      const document = {
        userId: "user-4",
        email: "user4@example.com",
        isActive: true,
      } as unknown as UserDocument;
      mockedUserModel.findOne.mockResolvedValueOnce(document);

      const result = await UserService.getById("user-4");

      expect(result).toEqual({
        id: "user-4",
        email: "user4@example.com",
        isActive: true,
      });
    });

    it("throws when id is missing", async () => {
      await expect(UserService.getById("")).rejects.toMatchObject({
        message: "User id cannot be empty.",
        statusCode: 400,
      });
    });
  });
});
