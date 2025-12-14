import {
  getData,
  postData,
  putData,
  deleteData,
  patchData,
} from "@/app/services/axios";
import { useAuthStore } from "@/app/stores/authStore";
import axios from "axios";

// --- Mocks ---

// Mock Auth Store
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

// Mock Axios
jest.mock("axios", () => {
  // Define mocks INSIDE the factory to avoid ReferenceError/Hoisting issues
  const mockRequestUse = jest.fn();
  const mockResponseUse = jest.fn();

  const mockInstance = jest.fn().mockImplementation((config) => {
    return Promise.resolve({ data: "retried data", config });
  }) as any;

  // Add methods to the mock instance
  mockInstance.get = jest.fn();
  mockInstance.post = jest.fn();
  mockInstance.put = jest.fn();
  mockInstance.delete = jest.fn();
  mockInstance.patch = jest.fn();

  // Attach interceptor mocks
  mockInstance.interceptors = {
    request: { use: mockRequestUse },
    response: { use: mockResponseUse },
  };
  mockInstance.defaults = { headers: {} };

  return {
    create: jest.fn(() => mockInstance),
    isAxiosError: jest.fn((payload) => payload?.isAxiosError),
    // Expose the internal mock instance to access it in tests
    _mockInstance: mockInstance,
  };
});

describe("Axios Service", () => {
  const mockGetState = useAuthStore.getState as jest.Mock;

  // Access the mocked instance exposed in the factory above
  const mockAxiosInstance = (axios as any)._mockInstance;
  const mockRequestUse = mockAxiosInstance.interceptors.request.use;
  const mockResponseUse = mockAxiosInstance.interceptors.response.use;

  // Variables to hold the actual callbacks passed to interceptors
  let requestSuccessHandler: any;
  let requestErrorHandler: any;
  let responseSuccessHandler: any;
  let responseErrorHandler: any;

  // Spies specifically for suppressing console logs during these tests
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeAll(() => {
    // Check if use was called
    expect(mockRequestUse).toHaveBeenCalled();
    expect(mockResponseUse).toHaveBeenCalled();

    // Extract the handlers so we can invoke them in tests
    // Ensure we have handlers to extract
    if (mockRequestUse.mock.calls.length > 0) {
      [requestSuccessHandler, requestErrorHandler] = mockRequestUse.mock.calls[0];
    }
    if (mockResponseUse.mock.calls.length > 0) {
      [responseSuccessHandler, responseErrorHandler] = mockResponseUse.mock.calls[0];
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // IMPORTANT: Spy on console in beforeEach to correctly override the
    // global jest.setup.ts configuration which throws errors on logs.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore the spies after every test to clean up
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // --- Helper Functions Tests ---

  describe("Wrapper Methods", () => {
    it("getData calls api.get", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: "ok" });
      await getData("/test", { id: 1 });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/test", { params: { id: 1 } });
    });

    it("getData handles errors", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("fail"));
      await expect(getData("/test")).rejects.toThrow("fail");
      expect(consoleErrorSpy).toHaveBeenCalledWith("API getData error:", expect.any(Error));
    });

    it("postData calls api.post", async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: "ok" });
      await postData("/test", { foo: "bar" });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/test", { foo: "bar" }, {});
    });

    it("postData handles errors", async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error("fail"));
      await expect(postData("/test")).rejects.toThrow("fail");
      expect(consoleErrorSpy).toHaveBeenCalledWith("API postData error:", expect.any(Error));
    });

    it("putData calls api.put", async () => {
      mockAxiosInstance.put.mockResolvedValue({ data: "ok" });
      await putData("/test", { foo: "bar" });
      expect(mockAxiosInstance.put).toHaveBeenCalledWith("/test", { foo: "bar" });
    });

    it("putData handles errors", async () => {
      mockAxiosInstance.put.mockRejectedValue(new Error("fail"));
      await expect(putData("/test")).rejects.toThrow("fail");
      expect(consoleErrorSpy).toHaveBeenCalledWith("API putData error:", expect.any(Error));
    });

    it("deleteData calls api.delete", async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: "ok" });
      await deleteData("/test", { id: 1 });
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/test", { params: { id: 1 } });
    });

    it("deleteData handles errors", async () => {
      mockAxiosInstance.delete.mockRejectedValue(new Error("fail"));
      await expect(deleteData("/test")).rejects.toThrow("fail");
      expect(consoleErrorSpy).toHaveBeenCalledWith("API deleteData error:", expect.any(Error));
    });

    it("patchData calls api.patch", async () => {
      mockAxiosInstance.patch.mockResolvedValue({ data: "ok" });
      await patchData("/test", { foo: "bar" });
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith("/test", { foo: "bar" }, {});
    });

    it("patchData handles errors", async () => {
      mockAxiosInstance.patch.mockRejectedValue(new Error("fail"));
      await expect(patchData("/test")).rejects.toThrow("fail");
      expect(consoleErrorSpy).toHaveBeenCalledWith("API patchData error:", expect.any(Error));
    });
  });

  // --- Request Interceptor Tests ---

  describe("Request Interceptor", () => {
    it("adds Authorization header if session exists", async () => {
      const mockToken = "mock-jwt";
      const mockSession = {
        getIdToken: () => ({ getJwtToken: () => mockToken }),
      };

      mockGetState.mockReturnValue({ session: mockSession });

      const config = { headers: {} };
      const result = await requestSuccessHandler(config);

      expect(result.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it("does not add Authorization header if no session", async () => {
      mockGetState.mockReturnValue({ session: null });

      const config = { headers: {} };
      const result = await requestSuccessHandler(config);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it("logs warning if accessing store fails", async () => {
      // Simulate error accessing state
      mockGetState.mockImplementationOnce(() => { throw new Error("Store Error"); });

      const config = { headers: {} };
      await requestSuccessHandler(config);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "No valid Cognito session available from AuthStore",
        expect.any(Error)
      );
    });

    it("handles request errors", async () => {
      const error = new Error("Request Fail");
      await expect(requestErrorHandler(error)).rejects.toThrow("Request Fail");
    });

    it("handles request errors that are not instances of Error", async () => {
       await expect(requestErrorHandler("String Error")).rejects.toThrow("String Error");
    });
  });

  // --- Response Interceptor Tests ---

  describe("Response Interceptor", () => {
    it("passes through successful responses", () => {
      const response = { data: "success" };
      expect(responseSuccessHandler(response)).toEqual(response);
    });

    it("throws error immediately if status is not 401", async () => {
      const error = {
        response: { status: 500 },
        config: {},
      };
      await expect(responseErrorHandler(error)).rejects.toEqual(error);
    });

    it("logs out and throws if request has already been retried", async () => {
      const mockSignout = jest.fn();
      mockGetState.mockReturnValue({ signout: mockSignout });

      const error = {
        response: { status: 401 },
        config: { _retry: true },
      };

      await expect(responseErrorHandler(error)).rejects.toEqual(error);
      expect(mockSignout).toHaveBeenCalled();
    });

    it("refreshes session and retries request on 401", async () => {
      const mockRefreshSession = jest.fn();
      const mockSignout = jest.fn();
      const mockToken = "new-jwt";
      const mockSession = {
        getIdToken: () => ({ getJwtToken: () => mockToken }),
      };

      mockGetState.mockReturnValue({
        refreshSession: mockRefreshSession,
        session: mockSession,
        signout: mockSignout,
      });

      const originalRequest = { headers: {}, _retry: false };
      const error = {
        response: { status: 401 },
        config: originalRequest,
      };

      // responseErrorHandler calls api(originalRequest) which is our mockAxiosInstance
      await responseErrorHandler(error);

      expect(originalRequest._retry).toBe(true);
      expect(mockRefreshSession).toHaveBeenCalled();
      expect(originalRequest.headers).toHaveProperty("Authorization", `Bearer ${mockToken}`);
      expect(mockAxiosInstance).toHaveBeenCalledWith(originalRequest);
    });

    it("logs out and throws if refresh session fails to return a session", async () => {
      const mockRefreshSession = jest.fn();
      const mockSignout = jest.fn();

      mockGetState.mockReturnValue({
        refreshSession: mockRefreshSession,
        session: null, // No session after refresh
        signout: mockSignout,
      });

      const error = { response: { status: 401 }, config: {} };
      await expect(responseErrorHandler(error)).rejects.toEqual(error);
      expect(mockSignout).toHaveBeenCalled();
    });

    it("logs out and throws if refreshSession throws error", async () => {
        const mockRefreshSession = jest.fn().mockRejectedValue(new Error("Refresh Fail"));
        const mockSignout = jest.fn();

        mockGetState.mockReturnValue({
          refreshSession: mockRefreshSession,
          signout: mockSignout,
        });

        const error = { response: { status: 401 }, config: {} };
        await expect(responseErrorHandler(error)).rejects.toEqual(error);
        expect(mockSignout).toHaveBeenCalled();
    });
  });
});