import { create } from "zustand";
import {
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
  ICognitoUserPoolData,
  ISignUpResult,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";

const poolData: ICognitoUserPoolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USERPOOLID || "",
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENTID || "",
};

let userPool: CognitoUserPool | undefined = undefined;

if (poolData.UserPoolId && poolData.ClientId) {
  userPool = new CognitoUserPool(poolData);
}

type AuthStore = {
  user: CognitoUser | null;
  session: CognitoUserSession | null;
  loading: boolean;
  error: string | null;
  role: string | null;
  signUp: (
    email: string,
    password: string,
    businessType: string
  ) => Promise<ISignUpResult | undefined>;
  confirmSignUp: (
    email: string,
    code: string
  ) => Promise<ISignUpResult | undefined>;
  resendCode: (email: string) => Promise<ISignUpResult | undefined>;
  signIn: (
    username: string,
    password: string
  ) => Promise<CognitoUserSession | null>;
  checkSession: () => Promise<CognitoUserSession | null>;
  signout: () => void;
  forgotPassword: (email: string) => Promise<{
    CodeDeliveryDetails: {
      AttributeName: string;
      DeliveryMedium: string;
      Destination: string;
    };
  } | null>;
  resetPassword: (
    email: string,
    code: string,
    password: string
  ) => Promise<string | null>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  error: null,
  role: null,

  signUp: async (email, password, businessType) => {
    if (!userPool) {
      throw new Error("UserPool is not initialized");
    }
    const attributeList = [
      new CognitoUserAttribute({ Name: "email", Value: email }),
      new CognitoUserAttribute({
        Name: "custom:businessType",
        Value: businessType,
      }),
      new CognitoUserAttribute({ Name: "custom:role", Value: "owner" }),
    ];
    return new Promise((resolve, reject) => {
      userPool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  },
  confirmSignUp: async (email, code) => {
    if (!userPool) {
      throw new Error("UserPool is not initialized");
    }
    const userData = {
      Username: email,
      Pool: userPool,
    };
    const cognitoUser = new CognitoUser(userData);
    return new Promise((resolve, reject) => {
      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  },
  resendCode: async (email) => {
    if (!userPool) {
      throw new Error("UserPool is not initialized");
    }
    const userData = {
      Username: email,
      Pool: userPool,
    };
    const cognitoUser = new CognitoUser(userData);
    return new Promise((resolve, reject) => {
      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  },
  signIn: async (email, password) => {
    if (!userPool) {
      throw new Error("UserPool is not initialized");
    }
    set({ loading: true, error: null });
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });
    const userData = {
      Username: email,
      Pool: userPool,
    };
    const cognitoUser = new CognitoUser(userData);

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session) => {
          const idTokenPayload = session.getIdToken().decodePayload();
          const role = idTokenPayload["custom:role"] || "";
          set({
            user: cognitoUser,
            session,
            loading: false,
            error: null,
            role,
          });
          resolve(session);
        },
        onFailure: (err) => {
          set({
            loading: false,
            error: err.message || "Authentication failed",
            user: null,
            session: null,
            role: null,
          });
          reject(err);
        },
      });
    });
  },
  checkSession: async () => {
    if (!userPool) {
      throw new Error("UserPool is not initialized");
    }
    set({ loading: true, error: null });

    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        set({
          user: null,
          session: null,
          loading: false,
        });
        return resolve(null);
      }
      cognitoUser.getSession(
        (err: Error | null, session: CognitoUserSession) => {
          if (err || !session?.isValid()) {
            set({
              user: null,
              session: null,
              loading: false,
              error: err?.message || null,
            });
            return resolve(null);
          }
          const idTokenPayload = session.getIdToken().decodePayload();
          const role = idTokenPayload["custom:role"] || "";
          set({
            user: cognitoUser,
            session,
            loading: false,
            error: null,
            role,
          });
          resolve(session);
        }
      );
    });
  },
  signout: () => {
    const user = get().user;
    if (user) {
      user.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session?.isValid()) {
            set({ user: null, session: null });
            return;
          }
          user.globalSignOut({
            onSuccess: () => {
              set({ user: null, session: null });
            },
            onFailure: (err: Error | null) => {
              set({ user: null, session: null });
            },
          });
        }
      );
    } else {
      set({ user: null, session: null });
    }
  },
  forgotPassword: async (email: string) => {
    if (!userPool) {
      throw new Error("UserPool is not initialized");
    }
    return new Promise((resolve, reject) => {
      const userData = {
        Username: email,
        Pool: userPool,
      };
      const cognitoUser = new CognitoUser(userData);
      cognitoUser.forgotPassword({
        onSuccess: (data) => {
          console.log(data);
          resolve(data);
        },
        onFailure: (err) => reject(err),
      });
    });
  },
  resetPassword: async (email: string, code: string, newPassword: string) => {
    if (!userPool) {
      throw new Error("UserPool is not initialized");
    }
    return new Promise((resolve, reject) => {
      const userData = {
        Username: email,
        Pool: userPool,
      };
      const cognitoUser = new CognitoUser(userData);
      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => resolve("success"),
        onFailure: (err) => reject(err),
      });
    });
  },
}));
