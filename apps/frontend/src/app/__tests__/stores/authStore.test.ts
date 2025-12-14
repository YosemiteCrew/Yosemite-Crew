// --- Global Mock Objects (Defined outside to remain stable across resets) ---

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

// --- Mocks Setup ---

// Mock orgStore
const mockClearOrgs = jest.fn();
jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(() => ({
      clearOrgs: mockClearOrgs,
    })),
  },
}));

// Mock Amazon Cognito with stable references
jest.mock("amazon-cognito-identity-js", () => {
  return {
    CognitoUserPool: jest.fn(() => mockPoolInstance),
    CognitoUser: jest.fn(() => mockUserInstance),
    CognitoUserAttribute: jest.fn().mockImplementation((x) => x),
    AuthenticationDetails: jest.fn(),
    CognitoUserSession: jest.fn(),
  };
});

describe("authStore", () => {
  let useAuthStore: any;

  beforeEach(async () => {
    // 1. Reset Modules to ensure authStore re-initializes
    jest.resetModules();

    // 2. Setup Env
    process.env.NEXT_PUBLIC_COGNITO_USERPOOLID = "us-east-1_test";
    process.env.NEXT_PUBLIC_COGNITO_CLIENTID = "test-client-id";

    // 3. Clear Mocks
    jest.clearAllMocks();
    mockClearOrgs.mockClear();

    // 4. Default Implementations (Resetting default behavior for every test)
    mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));
    mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);

    // 5. Dynamic Import
    const imported = await import("@/app/stores/authStore");
    useAuthStore = imported.useAuthStore;
  });

  describe("signUp", () => {
    it("calls userPool.signUp and resolves on success", async () => {
      const mockResult = { userSub: "123" };
      mockPoolInstance.signUp.mockImplementation((_e: any, _p: any, _a: any, _v: any, cb: any) => cb(null, mockResult));

      const result = await useAuthStore.getState().signUp("test@email.com", "pass", "John", "Doe");

      expect(mockPoolInstance.signUp).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it("rejects when signUp fails", async () => {
      const error = new Error("SignUp Failed");
      mockPoolInstance.signUp.mockImplementation((_e: any, _p: any, _a: any, _v: any, cb: any) => cb(error, null));

      await expect(
        useAuthStore.getState().signUp("test@email.com", "pass", "John", "Doe")
      ).rejects.toThrow("SignUp Failed");
    });

    it("rejects with generic error string if error is not Error object", async () => {
      mockPoolInstance.signUp.mockImplementation((_e: any, _p: any, _a: any, _v: any, cb: any) => cb("Network Error", null));

      await expect(
        useAuthStore.getState().signUp("test@email.com", "pass", "John", "Doe")
      ).rejects.toThrow("Network Error");
    });
  });

  describe("confirmSignUp", () => {
    it("calls cognitoUser.confirmRegistration and resolves", async () => {
      mockUserInstance.confirmRegistration.mockImplementation((_c: any, _f: any, cb: any) => cb(null, "SUCCESS"));

      const result = await useAuthStore.getState().confirmSignUp("test@email.com", "123456");

      expect(mockUserInstance.confirmRegistration).toHaveBeenCalled();
      expect(result).toBe("SUCCESS");
    });

    it("rejects on failure", async () => {
      mockUserInstance.confirmRegistration.mockImplementation((_c: any, _f: any, cb: any) => cb(new Error("Bad Code"), null));

      await expect(
        useAuthStore.getState().confirmSignUp("test@email.com", "123456")
      ).rejects.toThrow("Bad Code");
    });
  });

  describe("resendCode", () => {
    it("calls resendConfirmationCode and resolves", async () => {
      mockUserInstance.resendConfirmationCode.mockImplementation((cb: any) => cb(null, "SENT"));
      const result = await useAuthStore.getState().resendCode("test@email.com");
      expect(mockUserInstance.resendConfirmationCode).toHaveBeenCalled();
      expect(result).toBe("SENT");
    });

    it("rejects on failure", async () => {
      mockUserInstance.resendConfirmationCode.mockImplementation((cb: any) => cb(new Error("Fail"), null));
      await expect(
        useAuthStore.getState().resendCode("test@email.com")
      ).rejects.toThrow("Fail");
    });
  });

  describe("signIn", () => {
    it("authenticates user successfully and loads attributes", async () => {
      mockUserInstance.authenticateUser.mockImplementation((_authDetails: any, callbacks: any) => {
        callbacks.onSuccess(mockSession);
      });
      const mockAttrs = [{ getName: () => "email", getValue: () => "test@test.com" }];
      mockUserInstance.getUserAttributes.mockImplementation((cb: any) => cb(null, mockAttrs));

      await useAuthStore.getState().signIn("test@email.com", "pass");

      const state = useAuthStore.getState();
      expect(state.status).toBe("signin-authenticated");
      expect(state.attributes).toEqual({ email: "test@test.com" });
    });

    it("handles loadUserAttributes failure gracefully after signin", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockUserInstance.authenticateUser.mockImplementation((_authDetails: any, callbacks: any) => {
        callbacks.onSuccess(mockSession);
      });
      mockUserInstance.getUserAttributes.mockImplementation((cb: any) => cb(new Error("Attr Fail"), null));

      await useAuthStore.getState().signIn("test@email.com", "pass");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to load user attributes", expect.any(Error));
      expect(useAuthStore.getState().status).toBe("signin-authenticated");
      consoleSpy.mockRestore();
    });
  });

  describe("checkSession", () => {
    it("restores session if valid user exists", async () => {
      mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
      mockSession.isValid.mockReturnValue(true);
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe("authenticated");
      expect(state.user).not.toBeNull();
    });

    it("sets unauthenticated if no current user", async () => {
      mockPoolInstance.getCurrentUser.mockReturnValue(null);
      await useAuthStore.getState().checkSession();
      const state = useAuthStore.getState();
      expect(state.status).toBe("unauthenticated");
      expect(state.user).toBeNull();
    });

    it("sets unauthenticated if session is invalid", async () => {
        mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
        const invalidSession = { ...mockSession, isValid: () => false };
        mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, invalidSession));

        await useAuthStore.getState().checkSession();

        const state = useAuthStore.getState();
        expect(state.status).toBe("unauthenticated");
    });

    it("sets unauthenticated if getSession errors", async () => {
      mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(new Error("Session Error"), null));

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.status).toBe("unauthenticated");
      expect(state.error).toBe("Session Error");
    });
  });

  describe("refreshSession", () => {
    it("refreshes session successfully", async () => {
      mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
      mockSession.isValid.mockReturnValue(true);
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));

      await useAuthStore.getState().refreshSession();

      const state = useAuthStore.getState();
      expect(state.role).toBe("admin");
    });

    it("returns null if no user", async () => {
        mockPoolInstance.getCurrentUser.mockReturnValue(null);
        const res = await useAuthStore.getState().refreshSession();
        expect(res).toBeNull();
    });

    it("returns null on session error", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      mockPoolInstance.getCurrentUser.mockReturnValue(mockUserInstance);
      mockUserInstance.getSession.mockImplementation((cb: any) => cb(new Error("Fail"), null));

      const res = await useAuthStore.getState().refreshSession();
      expect(res).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe("signout", () => {
    it("signs out successfully", async () => {
        useAuthStore.setState({ user: mockUserInstance, status: 'authenticated' });
        mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));
        mockUserInstance.globalSignOut.mockImplementation(({ onSuccess }: any) => onSuccess());

        await useAuthStore.getState().signout();

        expect(mockUserInstance.globalSignOut).toHaveBeenCalled();
        expect(useAuthStore.getState().status).toBe("unauthenticated");
        expect(mockClearOrgs).toHaveBeenCalled();
    });

    it("handles signout failure but still resets state locally", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        useAuthStore.setState({ user: mockUserInstance, status: "authenticated" });

        mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, mockSession));
        mockUserInstance.globalSignOut.mockImplementation(({ onFailure }: any) => onFailure(new Error("Signout API Fail")));

        await useAuthStore.getState().signout();

        expect(consoleSpy).toHaveBeenCalled();
        expect(useAuthStore.getState().user).toBeNull();
        consoleSpy.mockRestore();
    });

    it("resolves early if no user in state", async () => {
        useAuthStore.setState({ user: null });
        await useAuthStore.getState().signout();
        expect(mockUserInstance.globalSignOut).not.toHaveBeenCalled();
    });

    it("handles invalid session during signout", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        useAuthStore.setState({ user: mockUserInstance });

        const invalidSession = { ...mockSession, isValid: () => false };
        mockUserInstance.getSession.mockImplementation((cb: any) => cb(null, invalidSession));

        await useAuthStore.getState().signout();

        expect(warnSpy).toHaveBeenCalledWith("Invalid session during signout");
        expect(mockUserInstance.globalSignOut).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("handles session error during signout", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        useAuthStore.setState({ user: mockUserInstance });

        mockUserInstance.getSession.mockImplementation((cb: any) => cb(new Error("Session Error"), null));

        await useAuthStore.getState().signout();

        expect(warnSpy).toHaveBeenCalledWith("getSession failed during signout:", expect.any(Error));
        warnSpy.mockRestore();
    });
  });

  describe("forgotPassword", () => {
    it("resolves on success", async () => {
      const mockData = { CodeDeliveryDetails: {} };
      mockUserInstance.forgotPassword.mockImplementation(({ onSuccess }: any) => onSuccess(mockData));
      const result = await useAuthStore.getState().forgotPassword("test@email.com");
      expect(result).toBe(mockData);
    });

    it("rejects on failure", async () => {
      mockUserInstance.forgotPassword.mockImplementation(({ onFailure }: any) => onFailure(new Error("Fail")));
      await expect(
        useAuthStore.getState().forgotPassword("test@email.com")
      ).rejects.toThrow("Fail");
    });
  });

  describe("resetPassword", () => {
    it("resolves success string on success", async () => {
      mockUserInstance.confirmPassword.mockImplementation((_c: any, _p: any, { onSuccess }: any) => onSuccess());
      const result = await useAuthStore.getState().resetPassword("email", "code", "newPass");
      expect(result).toBe("success");
    });

    it("rejects on failure", async () => {
      mockUserInstance.confirmPassword.mockImplementation((_c: any, _p: any, { onFailure }: any) => onFailure(new Error("Reset Fail")));
      await expect(
        useAuthStore.getState().resetPassword("email", "code", "newPass")
      ).rejects.toThrow("Reset Fail");
    });
  });

  describe("loadUserAttributes", () => {
      it("loads and sets attributes", async () => {
          useAuthStore.setState({ user: mockUserInstance });
          const mockAttrs = [
              { getName: () => "email", getValue: () => "me@test.com" }
          ];
          mockUserInstance.getUserAttributes.mockImplementation((cb: any) => cb(null, mockAttrs));

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
          useAuthStore.setState({ user: mockUserInstance });
          mockUserInstance.getUserAttributes.mockImplementation((cb: any) => cb(new Error("Attr Fail"), null));

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