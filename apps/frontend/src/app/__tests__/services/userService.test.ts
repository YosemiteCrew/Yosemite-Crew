import { updateUser } from "@/app/services/userService";

const patchDataMock = jest.fn();

jest.mock("@/app/services/axios", () => ({
  patchData: (...args: any[]) => patchDataMock(...args),
}));

const refreshSessionMock = jest.fn();
const loadUserAttributesMock = jest.fn();

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: {
    getState: () => ({
      refreshSession: refreshSessionMock,
      loadUserAttributes: loadUserAttributesMock,
    }),
  },
}));

describe("userService", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("updateUser", () => {
    it("updates user name and refreshes session", async () => {
      patchDataMock.mockResolvedValue({ data: {} });
      refreshSessionMock.mockResolvedValue(undefined);
      loadUserAttributesMock.mockResolvedValue(undefined);

      await updateUser("John", "Doe");

      expect(patchDataMock).toHaveBeenCalledWith("/fhir/v1/user/update-name", {
        firstName: "John",
        lastName: "Doe",
      });
      expect(refreshSessionMock).toHaveBeenCalled();
      expect(loadUserAttributesMock).toHaveBeenCalled();
    });

    it("calls refresh and load in order after patch", async () => {
      const callOrder: string[] = [];
      patchDataMock.mockImplementation(() => {
        callOrder.push("patch");
        return Promise.resolve({ data: {} });
      });
      refreshSessionMock.mockImplementation(() => {
        callOrder.push("refresh");
        return Promise.resolve();
      });
      loadUserAttributesMock.mockImplementation(() => {
        callOrder.push("load");
        return Promise.resolve();
      });

      await updateUser("Jane", "Smith");

      expect(callOrder).toEqual(["patch", "refresh", "load"]);
    });

    it("throws error when API call fails", async () => {
      patchDataMock.mockRejectedValue(new Error("API error"));

      await expect(updateUser("John", "Doe")).rejects.toThrow("API error");
      expect(console.error).toHaveBeenCalled();
      expect(refreshSessionMock).not.toHaveBeenCalled();
      expect(loadUserAttributesMock).not.toHaveBeenCalled();
    });

    it("throws error when refresh session fails", async () => {
      patchDataMock.mockResolvedValue({ data: {} });
      refreshSessionMock.mockRejectedValue(new Error("Refresh failed"));

      await expect(updateUser("John", "Doe")).rejects.toThrow("Refresh failed");
      expect(loadUserAttributesMock).not.toHaveBeenCalled();
    });

    it("throws error when load user attributes fails", async () => {
      patchDataMock.mockResolvedValue({ data: {} });
      refreshSessionMock.mockResolvedValue(undefined);
      loadUserAttributesMock.mockRejectedValue(new Error("Load failed"));

      await expect(updateUser("John", "Doe")).rejects.toThrow("Load failed");
    });

    it("handles empty names", async () => {
      patchDataMock.mockResolvedValue({ data: {} });
      refreshSessionMock.mockResolvedValue(undefined);
      loadUserAttributesMock.mockResolvedValue(undefined);

      await updateUser("", "");

      expect(patchDataMock).toHaveBeenCalledWith("/fhir/v1/user/update-name", {
        firstName: "",
        lastName: "",
      });
    });
  });
});
