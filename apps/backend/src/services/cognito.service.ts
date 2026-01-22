import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import logger from "src/utils/logger";

const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

export class CognitoServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CognitoServiceError";
  }
}

export const CognitoService = {
  async updateUserName(params: {
    userPoolId: string;
    cognitoUserId: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    try {
      await cognito.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: params.userPoolId,
          Username: params.cognitoUserId,
          UserAttributes: [
            { Name: "given_name", Value: params.firstName },
            { Name: "family_name", Value: params.lastName },
          ],
        }),
      );
    } catch (error) {
      logger.error("Erro in updating user name:", error)
      throw new CognitoServiceError("Failed to update user in Cognito.");
    }
  },
};