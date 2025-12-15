import {
  checkStatus,
  createConnectedAccount,
  onBoardConnectedAccount,
} from "@/app/services/stripeService";
import * as axiosService from "@/app/services/axios";

jest.mock("@/app/services/axios", () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

describe("stripeService", () => {
  const mockErrorLogger = jest.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockErrorLogger.mockRestore();
  });

  describe("checkStatus", () => {
    it("throws when orgId is missing", async () => {
      await expect(checkStatus(null)).rejects.toThrow("OrgId does not exist");
      expect(axiosService.getData).not.toHaveBeenCalled();
    });

    it("calls correct endpoint and returns data", async () => {
      (axiosService.getData as jest.Mock).mockResolvedValue({ data: { status: "active" } });

      const result = await checkStatus("org-123");

      expect(axiosService.getData).toHaveBeenCalledWith(
        "/v1/stripe/organisation/org-123/account/status"
      );
      expect(result).toEqual({ status: "active" });
    });
  });

  describe("createConnectedAccount", () => {
    it("throws when orgId is missing", async () => {
      await expect(createConnectedAccount(null)).rejects.toThrow("OrgId does not exist");
      expect(axiosService.postData).not.toHaveBeenCalled();
    });

    it("returns account id from API", async () => {
      (axiosService.postData as jest.Mock).mockResolvedValue({ data: { accountId: "acc_123" } });

      const accountId = await createConnectedAccount("org-123");

      expect(axiosService.postData).toHaveBeenCalledWith(
        "/v1/stripe/organisation/org-123/account"
      );
      expect(accountId).toBe("acc_123");
    });
  });

  describe("onBoardConnectedAccount", () => {
    it("throws when orgId is missing", async () => {
      await expect(onBoardConnectedAccount(null)).rejects.toThrow("OrgId does not exist");
      expect(axiosService.postData).not.toHaveBeenCalled();
    });

    it("returns client secret from API", async () => {
      (axiosService.postData as jest.Mock).mockResolvedValue({
        data: { client_secret: "secret_123" },
      });

      const clientSecret = await onBoardConnectedAccount("org-999");

      expect(axiosService.postData).toHaveBeenCalledWith(
        "/v1/stripe/organisation/org-999/onboarding"
      );
      expect(clientSecret).toBe("secret_123");
    });
  });
});
