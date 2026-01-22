import { useInvoiceStore } from "../stores/invoiceStore";
import { useOrgStore } from "../stores/orgStore";

export const loadInvoicesForOrgPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, setInvoicesForOrg } =
    useInvoiceStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load specialities.");
    return;
  }
  if (!shouldFetchInvoices(status, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    setInvoicesForOrg(primaryOrgId, []);
  } catch (err) {
    console.error("Failed to load specialities:", err);
    throw err;
  }
};

const shouldFetchInvoices = (
  status: ReturnType<typeof useInvoiceStore.getState>["status"],
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  return status === "idle" || status === "error";
};



