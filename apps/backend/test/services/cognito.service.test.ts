import { expect, jest, describe, it, beforeAll, beforeEach, afterAll } from '@jest/globals';
import logger from "../../src/utils/logger";

// Mock logger globally
jest.mock("../../src/utils/logger");

describe("CognitoService", () => {
  // Variables to hold the dynamic imports and mocks
  let CognitoService: any;
  let CognitoServiceError: any;
  let AdminUpdateUserAttributesCommand: any;

  // FIX: Type the mock as 'any' to allow mockResolvedValue({})
  let mockSend: jest.Mock<any>;

  beforeAll(() => {
    process.env.AWS_REGION = "us-east-1";

    // FIX: Initialize with generic type to prevent 'never' inference
    mockSend = jest.fn();

    // Use doMock to avoid hoisting issues.
    jest.doMock("@aws-sdk/client-cognito-identity-provider", () => ({
      CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
        send: mockSend,
      })),
      AdminUpdateUserAttributesCommand: jest.fn().mockImplementation((args) => args),
    }));

    // Require service dynamically triggers the top-level client instantiation
    const serviceModule = require("../../src/services/cognito.service");
    CognitoService = serviceModule.CognitoService;
    CognitoServiceError = serviceModule.CognitoServiceError;

    const sdkModule = require("@aws-sdk/client-cognito-identity-provider");
    AdminUpdateUserAttributesCommand = sdkModule.AdminUpdateUserAttributesCommand;
  });

  beforeEach(() => {
    mockSend.mockClear();
    (logger.error as jest.Mock).mockClear();
    if (AdminUpdateUserAttributesCommand && AdminUpdateUserAttributesCommand.mockClear) {
        AdminUpdateUserAttributesCommand.mockClear();
    }
  });

  afterAll(() => {
    jest.resetModules();
  });

  const validParams = {
    userPoolId: "pool-123",
    cognitoUserId: "sub-123",
    firstName: "John",
    lastName: "Doe",
  };

  describe("CognitoServiceError", () => {
    it("should instantiate with correct name and message", () => {
      const error = new CognitoServiceError("Test message");
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("CognitoServiceError");
      expect(error.message).toBe("Test message");
    });
  });

  describe("updateUserName", () => {
    it("should send AdminUpdateUserAttributesCommand with correct parameters", async () => {
      mockSend.mockResolvedValue({});

      await CognitoService.updateUserName(validParams);

      expect(AdminUpdateUserAttributesCommand).toHaveBeenCalledWith({
        UserPoolId: validParams.userPoolId,
        Username: validParams.cognitoUserId,
        UserAttributes: [
          { Name: "given_name", Value: validParams.firstName },
          { Name: "family_name", Value: validParams.lastName },
        ],
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should handle empty strings for names", async () => {
      mockSend.mockResolvedValue({});

      await CognitoService.updateUserName({
        ...validParams,
        firstName: "",
        lastName: "",
      });

      expect(AdminUpdateUserAttributesCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          UserAttributes: [
            { Name: "given_name", Value: "" },
            { Name: "family_name", Value: "" },
          ],
        })
      );
    });

    it("should throw CognitoServiceError and log error on SDK failure", async () => {
      const awsError = new Error("AWS Error");
      mockSend.mockRejectedValue(awsError);

      await expect(CognitoService.updateUserName(validParams)).rejects.toThrow(
        CognitoServiceError
      );

      await expect(CognitoService.updateUserName(validParams)).rejects.toThrow(
        "Failed to update user in Cognito."
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Erro in updating user name:",
        awsError
      );
    });
  });
});