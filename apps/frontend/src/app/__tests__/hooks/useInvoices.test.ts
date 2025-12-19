import { renderHook } from "@testing-library/react";
import { useLoadInvoicesForPrimaryOrg, useInvoicesForPrimaryOrg } from "../../hooks/useInvoices";
import { useOrgStore } from "../../stores/orgStore";
import { useInvoiceStore } from "../../stores/invoiceStore";
import { loadInvoicesForOrgPrimaryOrg } from "../../services/invoiceService";

// --- Mocks ---

jest.mock("../../stores/orgStore");
jest.mock("../../stores/invoiceStore");
jest.mock("../../services/invoiceService");

describe("useInvoices Hooks", () => {
  let mockOrgState: any;
  let mockInvoiceState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mock State
    mockOrgState = { primaryOrgId: null };
    mockInvoiceState = {
      invoicesById: {},
      invoiceIdsByOrgId: {},
    };

    // Setup Store Mocks to behave like Zustand selectors
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockOrgState)
    );
    (useInvoiceStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockInvoiceState)
    );
  });

  describe("useLoadInvoicesForPrimaryOrg", () => {
    it("should call load service when primaryOrgId is present", () => {
      mockOrgState.primaryOrgId = "org-1";

      renderHook(() => useLoadInvoicesForPrimaryOrg());

      expect(loadInvoicesForOrgPrimaryOrg).toHaveBeenCalledWith({ force: true });
      expect(loadInvoicesForOrgPrimaryOrg).toHaveBeenCalledTimes(1);
    });

    it("should NOT call load service when primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;

      renderHook(() => useLoadInvoicesForPrimaryOrg());

      expect(loadInvoicesForOrgPrimaryOrg).not.toHaveBeenCalled();
    });

    it("should re-call service when primaryOrgId changes", async () => {
      mockOrgState.primaryOrgId = "org-1";
      const { rerender } = renderHook(() => useLoadInvoicesForPrimaryOrg());

      expect(loadInvoicesForOrgPrimaryOrg).toHaveBeenCalledWith({ force: true });

      // Change Org ID
      mockOrgState.primaryOrgId = "org-2";
      rerender();

      expect(loadInvoicesForOrgPrimaryOrg).toHaveBeenCalledTimes(2);
    });
  });

  describe("useInvoicesForPrimaryOrg", () => {
    const mockInvoices = {
      "inv-1": { id: "inv-1", amount: 100 },
      "inv-2": { id: "inv-2", amount: 200 },
    };

    it("should return an empty array if primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;
      mockInvoiceState.invoicesById = mockInvoices;
      mockInvoiceState.invoiceIdsByOrgId = { "org-1": ["inv-1"] };

      const { result } = renderHook(() => useInvoicesForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("should return an empty array if no invoices exist for the organization", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockInvoiceState.invoicesById = mockInvoices;
      mockInvoiceState.invoiceIdsByOrgId = {}; // No entry for org-1

      const { result } = renderHook(() => useInvoicesForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("should return mapped invoice objects for the organization", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockInvoiceState.invoicesById = mockInvoices;
      mockInvoiceState.invoiceIdsByOrgId = { "org-1": ["inv-1", "inv-2"] };

      const { result } = renderHook(() => useInvoicesForPrimaryOrg());

      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual([
        { id: "inv-1", amount: 100 },
        { id: "inv-2", amount: 200 },
      ]);
    });

    it("should filter out undefined invoices (broken IDs)", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockInvoiceState.invoicesById = mockInvoices;
      // 'inv-99' exists in the list but not in invoicesById
      mockInvoiceState.invoiceIdsByOrgId = { "org-1": ["inv-1", "inv-99"] };

      const { result } = renderHook(() => useInvoicesForPrimaryOrg());

      // Should return only inv-1, filtering out the broken link
      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual({ id: "inv-1", amount: 100 });
    });
  });
});