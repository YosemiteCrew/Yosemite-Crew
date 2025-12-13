// --- Global Setup for Env Vars ---
// We set these initially, but we will also enforce them in beforeEach
process.env.NEXT_PUBLIC_COGNITO_USERPOOLID = "us-east-1_test";
process.env.NEXT_PUBLIC_COGNITO_CLIENTID = "test-client-id";

// --- Mocks ---

// Mock orgStore with a stable spy
const mockClearOrgs = jest.fn();
jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(() => ({
      clearOrgs: mockClearOrgs,
    })),
  },
}));

// Mock amazon-cognito-identity-js
jest.mock("amazon-cognito-identity-js", () => {
  const mockSession = {
    isValid: jest.fn(() => true),
    getIdToken: jest.fn(() => ({
      decodePayload: jest.fn(() => ({ "custom:role": "admin" })),
    })),
  };

  const mockUserInstance = {
    signUp: jest.fn(),
    confirmRegistration: jest.fn(),
    resendConfirmationCode: jest.fn(),
    authenticateUser: jest.fn(),
    getSession: jest.fn(),
    globalSignOut: jest.fn(),
    forgotPassword: jest.fn(),
    confirmPassword: jest.fn(),
    getUserAttributes: jest.fn(),
  };

  const mockPoolInstance = {
    signUp: jest.fn(),
    getCurrentUser: jest.fn(),
  };

  return {
    CognitoUserPool: jest.fn(() => mockPoolInstance),
    CognitoUser: jest.fn(() => mockUserInstance),
    CognitoUserAttribute: jest.fn().mockImplementation((x) => x),
    AuthenticationDetails: jest.fn(),
    CognitoUserSession: jest.fn(),
    // Expose mocks for usage in tests
    __mockUserInstance: mockUserInstance,
    __mockPoolInstance: mockPoolInstance,
    __mockSession: mockSession,
  };
});

// Helper to access mocked instances safely
const getMockUser = () => require("amazon-cognito-identity-js").__mockUserInstance;
const getMockPool = () => require("amazon-cognito-identity-js").__mockPoolInstance;
const getMockSession = () => require("amazon-cognito-identity-js").__mockSession;

describe("authStore", () => {
  // We declare a variable to hold the dynamically required store
  let useAuthStore: any;

  beforeEach(() => {
    // 1. Reset Modules to ensure authStore re-evaluates
    jest.resetModules();

    // 2. Ensure Env Vars are present before require
    process.env.NEXT_PUBLIC_COGNITO_USERPOOLID = "us-east-1_test";
    process.env.NEXT_PUBLIC_COGNITO_CLIENTID = "test-client-id";

    // 3. Clear all mocks
    jest.clearAllMocks();
    mockClearOrgs.mockClear();

    // 4. Default mock implementations
    getMockUser().getSession.mockImplementation((cb: any) => cb(null, getMockSession()));
    getMockPool().getCurrentUser.mockReturnValue(getMockUser());

    // 5. Require the store (this triggers the top-level UserPool initialization code)
    // We use require because import is hoisted and would run before jest.resetModules() effectively
    useAuthStore = require("@/app/stores/authStore").useAuthStore;
  });

  describe("signUp", () => {
    it("calls userPool.signUp and resolves on success", async () => {
      const mockResult = { userSub: "123" };
      getMockPool().signUp.mockImplementation((_e: any, _p: any, _a: any, _v: any, cb: any) => cb(null, mockResult));

      const result = await useAuthStore.getState().signUp("test@email.com", "pass", "John", "Doe");

      expect(getMockPool().signUp).toHaveBeenCalledWith(
        "test@email.com",
        "pass",
        expect.any(Array), // Attributes
        [],
        expect.any(Function)
      );
      expect(result).toEqual(mockResult);
    });

    it("rejects when signUp fails", async () => {
      const error = new Error("SignUp Failed");
      getMockPool().signUp.mockImplementation((_e: any, _p: any, _a: any, _v: any, cb: any) => cb(error, null));

      await expect(
        useAuthStore.getState().signUp("test@email.com", "pass", "John", "Doe")
      ).rejects.toThrow("SignUp Failed");
    });

    it("rejects with generic error string if error is not Error object", async () => {
        getMockPool().signUp.mockImplementation((_e: any, _p: any, _a: any, _v: any, cb: any) => cb("Network Error", null));

        await expect(
          useAuthStore.getState().signUp("test@email.com", "pass", "John", "Doe")
        ).rejects.toThrow("Network Error");
    });
  });

  describe("confirmSignUp", () => {
    it("calls cognitoUser.confirmRegistration and resolves", async () => {
      getMockUser().confirmRegistration.mockImplementation((_c: any, _f: any, cb: any) => cb(null, "SUCCESS"));

      const result = await useAuthStore.getState().confirmSignUp("test@email.com", "123456");

      expect(getMockUser().confirmRegistration).toHaveBeenCalledWith("123456", true, expect.any(Function));
      expect(result).toBe("SUCCESS");
    });

    it("rejects on failure", async () => {
      getMockUser().confirmRegistration.mockImplementation((_c: any, _f: any, cb: any) => cb(new Error("Bad Code"), null));

      await expect(
        useAuthStore.getState().confirmSignUp("test@email.com", "123456")
      ).rejects.toThrow("Bad Code");
    });
  });

  describe("resendCode", () => {
    it("calls resendConfirmationCode and resolves", async () => {
      getMockUser().resendConfirmationCode.mockImplementation((cb: any) => cb(null, "SENT"));

      const result = await useAuthStore.getState().resendCode("test@email.com");
      expect(getMockUser().resendConfirmationCode).toHaveBeenCalled();
      expect(result).toBe("SENT");
    });

    it("rejects on failure", async () => {
      getMockUser().resendConfirmationCode.mockImplementation((cb: any) => cb(new Error("Fail"), null));

      await expect(
        useAuthStore.getState().resendCode("test@email.com")
      ).rejects.toThrow("Fail");
    });
  });

  describe("signIn", () => {
    it("authenticates user successfully and loads attributes", async () => {
      const mockSession = getMockSession();
      getMockUser().authenticateUser.mockImplementation((_authDetails: any, callbacks: any) => {
        callbacks.onSuccess(mockSession);
      });
      // Mock loading attributes success
      const mockAttrs = [{ getName: () => "email", getValue: () => "test@test.com" }];
      getMockUser().getUserAttributes.mockImplementation((cb: any) => cb(null, mockAttrs));

      await useAuthStore.getState().signIn("test@email.com", "pass");

      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.session).toBe(mockSession);
      expect(state.role).toBe("admin"); // From mocked token payload
      expect(state.status).toBe("signin-authenticated");
      expect(state.attributes).toEqual({ email: "test@test.com" });
    });

    it("handles loadUserAttributes failure gracefully after signin", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const mockSession = getMockSession();

      getMockUser().authenticateUser.mockImplementation((_authDetails: any, callbacks: any) => {
        callbacks.onSuccess(mockSession);
      });
      // Fail attributes
      getMockUser().getUserAttributes.mockImplementation((cb: any) => cb(new Error("Attr Fail"), null));

      await useAuthStore.getState().signIn("test@email.com", "pass");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to load user attributes", expect.any(Error));
      expect(useAuthStore.getState().status).toBe("signin-authenticated"); // Still authenticated
      consoleSpy.mockRestore();
    });
  });

  describe("checkSession", () => {
    it("restores session if valid user exists", async () => {
      // Mock user exists in pool
      getMockPool().getCurrentUser.mockReturnValue(getMockUser());
      // Mock valid session
      getMockSession().isValid.mockReturnValue(true);
      getMockUser().getSession.mockImplementation((cb: any) => cb(null, getMockSession()));

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe("authenticated");
      expect(state.user).not.toBeNull();
    });

    it("sets unauthenticated if no current user", async () => {
      getMockPool().getCurrentUser.mockReturnValue(null);

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe("unauthenticated");
      expect(state.user).toBeNull();
    });

    it("sets unauthenticated if session is invalid", async () => {
      getMockPool().getCurrentUser.mockReturnValue(getMockUser());
      const invalidSession = { ...getMockSession(), isValid: () => false };
      getMockUser().getSession.mockImplementation((cb: any) => cb(null, invalidSession));

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe("unauthenticated");
    });

    it("sets unauthenticated if getSession errors", async () => {
      getMockPool().getCurrentUser.mockReturnValue(getMockUser());
      getMockUser().getSession.mockImplementation((cb: any) => cb(new Error("Session Error"), null));

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe("unauthenticated");
      expect(state.error).toBe("Session Error");
    });
  });

  describe("refreshSession", () => {
    it("refreshes session successfully", async () => {
      getMockPool().getCurrentUser.mockReturnValue(getMockUser());
      getMockSession().isValid.mockReturnValue(true);

      await useAuthStore.getState().refreshSession();

      const state = useAuthStore.getState();
      expect(state.session).toBeDefined();
      expect(state.role).toBe("admin");
    });

    it("returns null if no user", async () => {
      getMockPool().getCurrentUser.mockReturnValue(null);
      const res = await useAuthStore.getState().refreshSession();
      expect(res).toBeNull();
    });

    it("returns null on session error", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      getMockPool().getCurrentUser.mockReturnValue(getMockUser());
      getMockUser().getSession.mockImplementation((cb: any) => cb(new Error("Fail"), null));

      const res = await useAuthStore.getState().refreshSession();
      expect(res).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("signout", () => {
    it("signs out successfully and clears state", async () => {
      // Setup state with a user
      useAuthStore.setState({ user: getMockUser() as unknown as any, status: "authenticated" });

      getMockUser().getSession.mockImplementation((cb: any) => cb(null, getMockSession()));
      getMockUser().globalSignOut.mockImplementation(({ onSuccess }: any) => onSuccess());

      await useAuthStore.getState().signout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.status).toBe("unauthenticated");
      expect(getMockUser().globalSignOut).toHaveBeenCalled();
      expect(mockClearOrgs).toHaveBeenCalled();
    });

    it("handles signout failure but still resets state locally", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      useAuthStore.setState({ user: getMockUser() as unknown as any, status: "authenticated" });

      getMockUser().getSession.mockImplementation((cb: any) => cb(null, getMockSession()));
      getMockUser().globalSignOut.mockImplementation(({ onFailure }: any) => onFailure(new Error("Signout API Fail")));

      await useAuthStore.getState().signout();

      expect(consoleSpy).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull(); // Should still be reset
      consoleSpy.mockRestore();
    });

    it("resolves early if no user in state", async () => {
       useAuthStore.setState({ user: null });
       await useAuthStore.getState().signout();
       expect(getMockUser().globalSignOut).not.toHaveBeenCalled();
    });

    it("handles invalid session during signout", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        useAuthStore.setState({ user: getMockUser() as unknown as any });

        // Session invalid
        getMockSession().isValid.mockReturnValue(false);
        getMockUser().getSession.mockImplementation((cb: any) => cb(null, getMockSession()));

        await useAuthStore.getState().signout();

        expect(warnSpy).toHaveBeenCalledWith("Invalid session during signout");
        expect(getMockUser().globalSignOut).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("handles session error during signout", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        useAuthStore.setState({ user: getMockUser() as unknown as any });

        getMockUser().getSession.mockImplementation((cb: any) => cb(new Error("Session Error"), null));

        await useAuthStore.getState().signout();

        expect(warnSpy).toHaveBeenCalledWith("getSession failed during signout:", expect.any(Error));
        warnSpy.mockRestore();
    });
  });

  describe("forgotPassword", () => {
    it("resolves on success", async () => {
      const mockData = { CodeDeliveryDetails: {} };
      getMockUser().forgotPassword.mockImplementation(({ onSuccess }: any) => onSuccess(mockData));

      const result = await useAuthStore.getState().forgotPassword("test@email.com");
      expect(result).toBe(mockData);
    });

    it("rejects on failure", async () => {
      getMockUser().forgotPassword.mockImplementation(({ onFailure }: any) => onFailure(new Error("Fail")));

      await expect(
        useAuthStore.getState().forgotPassword("test@email.com")
      ).rejects.toThrow("Fail");
    });
  });

  describe("resetPassword", () => {
    it("resolves success string on success", async () => {
      getMockUser().confirmPassword.mockImplementation((_c: any, _p: any, { onSuccess }: any) => onSuccess());

      const result = await useAuthStore.getState().resetPassword("email", "code", "newPass");
      expect(result).toBe("success");
    });

    it("rejects on failure", async () => {
      getMockUser().confirmPassword.mockImplementation((_c: any, _p: any, { onFailure }: any) => onFailure(new Error("Reset Fail")));

      await expect(
        useAuthStore.getState().resetPassword("email", "code", "newPass")
      ).rejects.toThrow("Reset Fail");
    });
  });

  describe("loadUserAttributes", () => {
      it("loads and sets attributes", async () => {
          useAuthStore.setState({ user: getMockUser() as unknown as any });
          const mockAttrs = [
              { getName: () => "email", getValue: () => "me@test.com" }
          ];
          getMockUser().getUserAttributes.mockImplementation((cb: any) => cb(null, mockAttrs));

          const res = await useAuthStore.getState().loadUserAttributes();

          expect(res).toEqual({ email: "me@test.com" });
          expect(useAuthStore.getState().attributes).toEqual({ email: "me@test.com" });
      });

      it("returns null if no user", async () => {
          useAuthStore.setState({ user: null });
          const res = await useAuthStore.getState().loadUserAttributes();
          expect(res).toBeNull();
      });

      it("rejects on API error", async () => {
          useAuthStore.setState({ user: getMockUser() as unknown as any });
          getMockUser().getUserAttributes.mockImplementation((cb: any) => cb(new Error("Attr Fail"), null));

          await expect(
              useAuthStore.getState().loadUserAttributes()
          ).rejects.toThrow("Attr Fail");
      });
  });

  describe("Environment Edge Case", () => {
    it("handles signout when globalThis is undefined (simulated)", async () => {
        // We override the spy behavior ONCE for this specific test
        mockClearOrgs.mockImplementationOnce(() => {
          throw new Error("Store Error");
        });

        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        await useAuthStore.getState().signout();

        expect(warnSpy).toHaveBeenCalledWith("Failed to clear org store on signout", expect.any(Error));
        warnSpy.mockRestore();
    });
  });
});