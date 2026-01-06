// invoiceService.test.ts
import { loadInvoicesForOrgPrimaryOrg } from "../../services/invoiceService";
import { getData } from "../../services/axios";
import { useOrgStore } from "../../stores/orgStore";
import { useInvoiceStore } from "../../stores/invoiceStore";
import { fromInvoiceRequestDTO } from "@yosemite-crew/types";
import type { InvoiceRequestDTO } from "@yosemite-crew/types";

// --- Mocks ---

// 1. Mock Axios
jest.mock("../../services/axios");
const mockedGetData = getData as jest.Mock;

// 2. Mock Stores
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock("../../stores/invoiceStore", () => ({
  useInvoiceStore: {
    getState: jest.fn(),
  },
}));

// 3. Mock External Utils
jest.mock("@yosemite-crew/types", () => ({
  fromInvoiceRequestDTO: jest.fn(),
}));
const mockedFromInvoiceDTO = fromInvoiceRequestDTO as jest.Mock;

describe("Invoice Service", () => {
  // Store spies
  const mockInvoiceStoreStartLoading = jest.fn();
  const mockInvoiceStoreSetInvoicesForOrg = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Store State Setup
    (useInvoiceStore.getState as jest.Mock).mockReturnValue({
      startLoading: mockInvoiceStoreStartLoading,
      setInvoicesForOrg: mockInvoiceStoreSetInvoicesForOrg,
      status: "idle",
    });

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-123",
    });
  });

  // --- Section 1: loadInvoicesForOrgPrimaryOrg ---
  describe("loadInvoicesForOrgPrimaryOrg", () => {
    it("warns and returns if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await loadInvoicesForOrgPrimaryOrg();

      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot load specialities."
      );
      expect(mockedGetData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("skips fetch if status is 'loaded' and not forced", async () => {
      (useInvoiceStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockInvoiceStoreStartLoading,
        setInvoicesForOrg: mockInvoiceStoreSetInvoicesForOrg,
      });

      await loadInvoicesForOrgPrimaryOrg();

      expect(mockedGetData).not.toHaveBeenCalled();
    });

    it("fetches if forced even when loaded", async () => {
      (useInvoiceStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockInvoiceStoreStartLoading,
        setInvoicesForOrg: mockInvoiceStoreSetInvoicesForOrg,
      });

      mockedGetData.mockResolvedValue({ data: [] });

      await loadInvoicesForOrgPrimaryOrg({ force: true });

      expect(mockedGetData).toHaveBeenCalledWith(
        "/v1/organisation-document/pms/org-123/documents"
      );
    });

    it("does not trigger startLoading if silent option is true", async () => {
      mockedGetData.mockResolvedValue({ data: [] });

      await loadInvoicesForOrgPrimaryOrg({ silent: true });

      expect(mockInvoiceStoreStartLoading).not.toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith(
        "/v1/organisation-document/pms/org-123/documents"
      );
    });

    it("fetches successfully, maps invoices, and updates store", async () => {
      const apiResponse: InvoiceRequestDTO[] = [
        { id: "inv-1" } as any,
        { id: "inv-2" } as any,
      ];

      mockedGetData.mockResolvedValue({ data: apiResponse });

      // Mock DTO transformation results
      mockedFromInvoiceDTO
        .mockReturnValueOnce({ id: "inv-1-normalized" })
        .mockReturnValueOnce({ id: "inv-2-normalized" });

      await loadInvoicesForOrgPrimaryOrg();

      expect(mockInvoiceStoreStartLoading).toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith(
        "/v1/organisation-document/pms/org-123/documents"
      );

      expect(mockedFromInvoiceDTO).toHaveBeenCalledTimes(2);
      expect(mockedFromInvoiceDTO).toHaveBeenNthCalledWith(1, apiResponse[0]);
      expect(mockedFromInvoiceDTO).toHaveBeenNthCalledWith(2, apiResponse[1]);

      expect(mockInvoiceStoreSetInvoicesForOrg).toHaveBeenCalledWith("org-123", [
        { id: "inv-1-normalized" },
        { id: "inv-2-normalized" },
      ]);
    });

    it("handles empty response data gracefully", async () => {
      mockedGetData.mockResolvedValue({ data: undefined });

      await loadInvoicesForOrgPrimaryOrg();

      expect(mockInvoiceStoreSetInvoicesForOrg).toHaveBeenCalledWith("org-123", []);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Network Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(loadInvoicesForOrgPrimaryOrg()).rejects.toThrow("Network Error");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to load specialities:", error);
      consoleSpy.mockRestore();
    });
  });
});
