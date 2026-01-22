import { loadInvoicesForOrgPrimaryOrg } from "../../services/invoiceService";
import { useInvoiceStore } from "../../stores/invoiceStore";
import { useOrgStore } from "../../stores/orgStore";

type InvoiceState = {
  startLoading: jest.Mock;
  setInvoicesForOrg: jest.Mock;
  status: "idle" | "loading" | "loaded" | "error";
};

type OrgState = {
  primaryOrgId: string | null;
};

jest.mock("../../stores/invoiceStore", () => ({
  useInvoiceStore: { getState: jest.fn() },
}));

jest.mock("../../stores/orgStore", () => ({
  useOrgStore: { getState: jest.fn() },
}));

describe("invoiceService", () => {
  let invoiceState: InvoiceState;
  let orgState: OrgState;

  beforeEach(() => {
    jest.clearAllMocks();
    invoiceState = {
      startLoading: jest.fn(),
      setInvoicesForOrg: jest.fn(),
      status: "idle",
    };
    orgState = { primaryOrgId: "org-1" };

    (useInvoiceStore.getState as jest.Mock).mockReturnValue(invoiceState);
    (useOrgStore.getState as jest.Mock).mockReturnValue(orgState);
  });

  it("loads invoices when idle", async () => {
    await loadInvoicesForOrgPrimaryOrg();

    expect(invoiceState.startLoading).toHaveBeenCalled();
    expect(invoiceState.setInvoicesForOrg).toHaveBeenCalledWith("org-1", []);
  });

  it("skips loading when already loading", async () => {
    invoiceState.status = "loading";

    await loadInvoicesForOrgPrimaryOrg();

    expect(invoiceState.startLoading).not.toHaveBeenCalled();
    expect(invoiceState.setInvoicesForOrg).not.toHaveBeenCalled();
  });

  it("skips loading when primary org is missing", async () => {
    orgState.primaryOrgId = null;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await loadInvoicesForOrgPrimaryOrg();

    expect(invoiceState.startLoading).not.toHaveBeenCalled();
    expect(invoiceState.setInvoicesForOrg).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("forces loading when requested", async () => {
    invoiceState.status = "loaded";

    await loadInvoicesForOrgPrimaryOrg({ force: true, silent: true });

    expect(invoiceState.startLoading).not.toHaveBeenCalled();
    expect(invoiceState.setInvoicesForOrg).toHaveBeenCalledWith("org-1", []);
  });
});
