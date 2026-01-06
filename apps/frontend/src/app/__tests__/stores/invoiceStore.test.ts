import { useInvoiceStore } from "../../stores/invoiceStore";
import { Invoice } from "@yosemite-crew/types";

// --- Mock Data ---
// Cast to unknown first to avoid strict type adherence for fields not relevant to store logic

const mockInvoice1: Invoice = {
  id: "inv-1",
  organisationId: "org-A",
  status: "PENDING",
  items: [],
  subtotal: 100,
  totalAmount: 100,
  currency: "USD" as any,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
} as unknown as Invoice;

const mockInvoice2: Invoice = {
  id: "inv-2",
  organisationId: "org-A",
  status: "PAID",
  items: [],
  subtotal: 200,
  totalAmount: 200,
  currency: "USD" as any,
  createdAt: new Date("2025-01-02T00:00:00.000Z"),
  updatedAt: new Date("2025-01-02T00:00:00.000Z"),
} as unknown as Invoice;

const mockInvoice3: Invoice = {
  id: "inv-3",
  organisationId: "org-B",
  status: "AWAITING_PAYMENT",
  items: [],
  subtotal: 50,
  totalAmount: 50,
  currency: "USD" as any,
  createdAt: new Date("2025-01-03T00:00:00.000Z"),
  updatedAt: new Date("2025-01-03T00:00:00.000Z"),
} as unknown as Invoice;

const mockInvoiceNoId: Invoice = {
  organisationId: "org-A",
  status: "PENDING",
  items: [],
  subtotal: 10,
  totalAmount: 10,
  currency: "USD" as any,
  createdAt: new Date("2025-01-04T00:00:00.000Z"),
  updatedAt: new Date("2025-01-04T00:00:00.000Z"),
} as unknown as Invoice;

const mockInvoiceNoOrg: Invoice = {
  id: "inv-bad",
  status: "PENDING",
  items: [],
  subtotal: 10,
  totalAmount: 10,
  currency: "USD" as any,
  createdAt: new Date("2025-01-04T00:00:00.000Z"),
  updatedAt: new Date("2025-01-04T00:00:00.000Z"),
} as unknown as Invoice;

describe("Invoice Store", () => {
  beforeEach(() => {
    useInvoiceStore.setState({
      invoicesById: {},
      invoiceIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization & Status ---
  describe("Initialization & Status", () => {
    it("initializes with default empty state", () => {
      const state = useInvoiceStore.getState();
      expect(state.invoicesById).toEqual({});
      expect(state.invoiceIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
      expect(state.lastFetchedAt).toBeNull();
    });

    it("manages loading state", () => {
      const store = useInvoiceStore.getState();

      store.startLoading();
      expect(useInvoiceStore.getState().status).toBe("loading");
      expect(useInvoiceStore.getState().error).toBeNull();

      store.endLoading();
      expect(useInvoiceStore.getState().status).toBe("loaded");
      expect(useInvoiceStore.getState().error).toBeNull();
    });

    it("sets error state", () => {
      const store = useInvoiceStore.getState();

      store.setError("Failed to fetch invoices");
      expect(useInvoiceStore.getState().status).toBe("error");
      expect(useInvoiceStore.getState().error).toBe("Failed to fetch invoices");
    });

    it("clears the store completely", () => {
      useInvoiceStore.getState().setInvoices([mockInvoice1]);

      useInvoiceStore.getState().clearInvoices();

      const state = useInvoiceStore.getState();
      expect(state.invoicesById).toEqual({});
      expect(state.invoiceIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.lastFetchedAt).toBeNull();
    });
  });

  // --- Section 2: Bulk Set & Getters ---
  describe("Bulk Operations", () => {
    it("sets all invoices globally and indexes them correctly", () => {
      useInvoiceStore
        .getState()
        .setInvoices([mockInvoice1, mockInvoice2, mockInvoice3]);

      const state = useInvoiceStore.getState();
      expect(state.status).toBe("loaded");

      expect(state.invoicesById["inv-1"]).toEqual(mockInvoice1);
      expect(state.invoicesById["inv-3"]).toEqual(mockInvoice3);

      expect(state.invoiceIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.invoiceIdsByOrgId["org-A"]).toContain("inv-1");
      expect(state.invoiceIdsByOrgId["org-A"]).toContain("inv-2");
      expect(state.invoiceIdsByOrgId["org-B"]).toEqual(["inv-3"]);
      expect(state.lastFetchedAt).toEqual(expect.any(String));
    });

    it("skips invoices missing id or organisationId during setInvoices", () => {
      useInvoiceStore
        .getState()
        .setInvoices([mockInvoice1, mockInvoiceNoId, mockInvoiceNoOrg]);

      const state = useInvoiceStore.getState();
      expect(state.invoicesById["inv-1"]).toBeDefined();

      // inv-bad should be skipped (missing orgId)
      expect(state.invoicesById["inv-bad"]).toBeUndefined();

      // no-id should be skipped
      expect(Object.keys(state.invoicesById)).toEqual(["inv-1"]);
      expect(state.invoiceIdsByOrgId["org-A"]).toEqual(["inv-1"]);
    });

    it("sets invoices for a specific org (replaces org slice)", () => {
      // Seed with org-A + org-B
      useInvoiceStore.getState().setInvoices([mockInvoice1, mockInvoice3]);

      // Replace ONLY org-A: remove inv-1, add inv-2
      useInvoiceStore.getState().setInvoicesForOrg("org-A", [mockInvoice2]);

      const state = useInvoiceStore.getState();

      // Org A now only inv-2
      expect(state.invoiceIdsByOrgId["org-A"]).toEqual(["inv-2"]);
      expect(state.invoicesById["inv-1"]).toBeUndefined();
      expect(state.invoicesById["inv-2"]).toBeDefined();

      // Org B unchanged
      expect(state.invoiceIdsByOrgId["org-B"]).toEqual(["inv-3"]);
      expect(state.invoicesById["inv-3"]).toBeDefined();
    });

    it("retrieves invoices by orgId", () => {
      useInvoiceStore
        .getState()
        .setInvoices([mockInvoice1, mockInvoice2, mockInvoice3]);

      const orgAInvoices = useInvoiceStore
        .getState()
        .getInvoicesByOrgId("org-A");
      expect(orgAInvoices).toHaveLength(2);
      expect(orgAInvoices.find((i) => i.id === "inv-1")).toBeDefined();

      expect(useInvoiceStore.getState().getInvoicesByOrgId("org-C")).toEqual(
        []
      );
    });

    it("retrieves invoices by status for an org", () => {
      useInvoiceStore
        .getState()
        .setInvoices([mockInvoice1, mockInvoice2, mockInvoice3]);

      const paidOrgA = useInvoiceStore
        .getState()
        .getInvoicesByStatus("org-A", "PAID" as any);
      expect(paidOrgA).toHaveLength(1);
      expect(paidOrgA[0].id).toBe("inv-2");

      const pendingOrgA = useInvoiceStore
        .getState()
        .getInvoicesByStatus("org-A", "PENDING" as any);
      expect(pendingOrgA).toHaveLength(1);
      expect(pendingOrgA[0].id).toBe("inv-1");

      // OrgB has awaiting payment
      const awaitingOrgB = useInvoiceStore
        .getState()
        .getInvoicesByStatus("org-B", "AWAITING_PAYMENT" as any);
      expect(awaitingOrgB).toHaveLength(1);
      expect(awaitingOrgB[0].id).toBe("inv-3");
    });
  });

  // --- Section 3: Upsert Operations ---
  describe("Upsert Operations", () => {
    it("adds a new invoice if it does not exist", () => {
      useInvoiceStore.getState().setInvoices([mockInvoice1]);

      useInvoiceStore.getState().upsertInvoice(mockInvoice2);

      const state = useInvoiceStore.getState();
      expect(state.invoicesById["inv-2"]).toBeDefined();
      expect(state.invoiceIdsByOrgId["org-A"]).toContain("inv-2");
      expect(state.invoiceIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.status).toBe("loaded");
      expect(state.lastFetchedAt).toEqual(expect.any(String));
    });

    it("updates an existing invoice and does not duplicate the ID in org index", () => {
      useInvoiceStore.getState().setInvoices([mockInvoice1]);

      const updated = { ...mockInvoice1, subtotal: 999 } as unknown as Invoice;
      useInvoiceStore.getState().upsertInvoice(updated);

      const state = useInvoiceStore.getState();
      expect(state.invoicesById["inv-1"].subtotal).toBe(999);
      expect(state.invoiceIdsByOrgId["org-A"]).toHaveLength(1);
    });

    it("warns and does nothing if id or organisationId is missing", () => {
      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      useInvoiceStore.getState().upsertInvoice(mockInvoiceNoOrg);
      useInvoiceStore.getState().upsertInvoice(mockInvoiceNoId);

      const state = useInvoiceStore.getState();
      expect(Object.keys(state.invoicesById)).toHaveLength(0);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("handles upsert for a new organization not yet in store", () => {
      useInvoiceStore.getState().upsertInvoice(mockInvoice3);

      const state = useInvoiceStore.getState();
      expect(state.invoiceIdsByOrgId["org-B"]).toEqual(["inv-3"]);
      expect(state.invoicesById["inv-3"]).toBeDefined();
    });
  });

  // --- Section 4: Removal & Cleanup ---
  describe("Removal & Cleanup", () => {
    it("removes an invoice by id", () => {
      useInvoiceStore.getState().setInvoices([mockInvoice1, mockInvoice2]);

      useInvoiceStore.getState().removeInvoice("inv-1");

      const state = useInvoiceStore.getState();
      expect(state.invoicesById["inv-1"]).toBeUndefined();
      expect(state.invoicesById["inv-2"]).toBeDefined();
      expect(state.invoiceIdsByOrgId["org-A"]).toEqual(["inv-2"]);
    });

    it("does nothing when removing a non-existent id", () => {
      useInvoiceStore.getState().setInvoices([mockInvoice1]);
      const initialSnapshot = JSON.stringify(useInvoiceStore.getState());

      useInvoiceStore.getState().removeInvoice("fake-id");

      const finalSnapshot = JSON.stringify(useInvoiceStore.getState());
      expect(finalSnapshot).toEqual(initialSnapshot);
    });

    it("clears invoices for an org (and leaves other orgs untouched)", () => {
      useInvoiceStore.getState().setInvoices([mockInvoice1, mockInvoice3]);

      useInvoiceStore.getState().clearInvoicesForOrg("org-A");

      const state = useInvoiceStore.getState();
      expect(state.invoiceIdsByOrgId["org-A"]).toBeUndefined();
      expect(state.invoicesById["inv-1"]).toBeUndefined();

      // Org B remains
      expect(state.invoiceIdsByOrgId["org-B"]).toBeDefined();
      expect(state.invoicesById["inv-3"]).toBeDefined();
    });

    it("handles clearing an org that has no data safely", () => {
      useInvoiceStore.getState().setInvoices([mockInvoice1]);

      useInvoiceStore.getState().clearInvoicesForOrg("org-Empty");

      const state = useInvoiceStore.getState();
      expect(state.invoiceIdsByOrgId["org-Empty"]).toBeUndefined();
      expect(state.invoicesById["inv-1"]).toBeDefined();
    });
  });
});
