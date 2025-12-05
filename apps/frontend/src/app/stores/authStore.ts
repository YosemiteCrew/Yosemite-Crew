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

type Status = "idle" | "checking" | "authenticated" | "unauthenticated";

type AuthStore = {
  user: CognitoUser | null;
  attributes: Record<string, string> | null;
  status: Status;
  session: CognitoUserSession | null;
  loading: boolean;
  error: string | null;
  role: string | null;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role?: string
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
  loadUserAttributes: () => Promise<Record<string, string> | null>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  attributes: null,
  status: "idle",
  session: null,
  loading: false,
  error: null,
  role: null,

  signUp: async (email, password, firstName, lastName, role = "member") => {
    if (!userPool) {
      throw new Error("UserPool is not initialized");
    }
    const attributeList = [
      new CognitoUserAttribute({ Name: "email", Value: email }),
      new CognitoUserAttribute({
        Name: "given_name",
        Value: firstName,
      }),
      new CognitoUserAttribute({ Name: "family_name", Value: lastName }),
      new CognitoUserAttribute({ Name: "custom:role", Value: role }),
    ];
    return new Promise((resolve, reject) => {
      userPool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
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
          reject(err instanceof Error ? err : new Error(String(err)));
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
          reject(err instanceof Error ? err : new Error(String(err)));
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
    set({ loading: true, error: null, status: "checking" });
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });
    const userData = {
      Username: email,
      Pool: userPool,
    };
    const cognitoUser = new CognitoUser(userData);

    const handleAuthSuccess = async (session: CognitoUserSession) => {
      const idTokenPayload = session.getIdToken().decodePayload();
      const role = idTokenPayload["custom:role"] || "";
      let mapped: Record<string, string> | null = null;
      try {
        mapped = await get().loadUserAttributes();
      } catch (e) {
        console.error("Failed to load user attributes", e);
      }
      set({
        user: cognitoUser,
        session,
        loading: false,
        error: null,
        role,
        status: "authenticated",
        attributes: mapped,
      });
    };

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session) => {
          void handleAuthSuccess(session);
          resolve(session);
        },
        onFailure: (err) => {
          set({
            loading: false,
            error: err.message || "Authentication failed",
            user: null,
            session: null,
            role: null,
            status: "unauthenticated",
            attributes: null,
          });
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      });
    });
  },
  checkSession: async () => {
    if (!userPool) {
      throw new Error("UserPool is not initialized");
    }
    set({ loading: true, error: null, status: "checking" });

    const handleSessionSuccess = async (
      cognitoUser: CognitoUser,
      session: CognitoUserSession,
      role: string
    ) => {
      let mapped: Record<string, string> | null = null;
      try {
        mapped = await get().loadUserAttributes();
      } catch (e) {
        console.error("Failed to load user attributes", e);
      }
      set({
        user: cognitoUser,
        status: "authenticated",
        session,
        loading: false,
        error: null,
        role,
        attributes: mapped,
      });
    };
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        set({
          user: null,
          session: null,
          loading: false,
          status: "unauthenticated",
          attributes: null,
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
              status: "unauthenticated",
              attributes: null,
            });
            return resolve(null);
          }
          const idTokenPayload = session.getIdToken().decodePayload();
          const role = idTokenPayload["custom:role"] || "";
          void handleSessionSuccess(cognitoUser, session, role);
          resolve(session);
        }
      );
    });
  },
  signout: () => {
    if (typeof globalThis !== "undefined") {
      globalThis.sessionStorage?.removeItem("devAuth");
    }
    const user = get().user;
    set({
      status: "unauthenticated",
      user: null,
      session: null,
      role: null,
      error: null,
      attributes: null,
    });
    if (!user) return;
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return;
      user.globalSignOut({
        onSuccess: () => {
          set({
            user: null,
            session: null,
            role: null,
            error: null,
            loading: false,
            status: "unauthenticated",
            attributes: null,
          });
        },
        onFailure: (err: Error | null) => {
          set({
            user: null,
            session: null,
            role: null,
            error: null,
            loading: false,
            status: "unauthenticated",
            attributes: null,
          });
        },
      });
    });
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
        onFailure: (err) =>
          reject(err instanceof Error ? err : new Error(String(err))),
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
        onFailure: (err) =>
          reject(err instanceof Error ? err : new Error(String(err))),
      });
    });
  },
  loadUserAttributes: async () => {
    const { user } = get();
    if (!user) return null;
    return new Promise((resolve, reject) => {
      user.getUserAttributes((err, attrs) => {
        if (err) return reject(err);
        const mapped: Record<string, string> = {};
        for (const a of attrs || []) {
          mapped[a.getName()] = a.getValue();
        }
        set({ attributes: mapped });
        resolve(mapped);
      });
    });
  },
}));
