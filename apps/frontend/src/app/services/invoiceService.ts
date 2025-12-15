import { fromInvoiceRequestDTO, InvoiceRequestDTO } from "@yosemite-crew/types";
import { useInvoiceStore } from "../stores/invoiceStore";
import { useOrgStore } from "../stores/orgStore";
import { getData } from "./axios";

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
    const res = await getData<InvoiceRequestDTO[]>(
      "/v1/organisation-document/pms/" + primaryOrgId + "/documents"
    );
    const data = res.data || [];
    const normalInvoices = data.map((dto) => fromInvoiceRequestDTO(dto));
    setInvoicesForOrg(primaryOrgId, normalInvoices);
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



