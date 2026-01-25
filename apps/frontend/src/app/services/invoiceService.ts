import {
  fromInvoiceRequestDTO,
  InvoiceItem,
  InvoiceResponseDTO,
} from "@yosemite-crew/types";
import { useInvoiceStore } from "../stores/invoiceStore";
import { useOrgStore } from "../stores/orgStore";
import { getData, postData } from "./axios";

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
    const res = await getData<InvoiceResponseDTO[]>(
      "/fhir/v1/invoice/organisation/" + primaryOrgId + "/list",
    );
    const invoices = res.data.map((fhirInvoice) =>
      fromInvoiceRequestDTO(fhirInvoice),
    );
    setInvoicesForOrg(primaryOrgId, invoices);
  } catch (err) {
    console.error("Failed to load specialities:", err);
    throw err;
  }
};

const shouldFetchInvoices = (
  status: ReturnType<typeof useInvoiceStore.getState>["status"],
  opts?: { force?: boolean },
) => {
  if (opts?.force) return true;
  return status === "idle" || status === "error";
};

export const addLineItemsToAppointments = async (
  lineItems: InvoiceItem[],
  appointmentId: string,
): Promise<void> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot add.");
    return;
  }
  try {
    if (!appointmentId || lineItems.length <= 0) {
      throw new Error("Line items or Appointment ID missing");
    }
    const body = {
      items: lineItems,
      currency: "usd",
    };
    await postData<InvoiceResponseDTO[]>(
      "/fhir/v1/invoice/appointment/" + appointmentId + "/charges",
      body,
    );
  } catch (err) {
    console.error("Failed to load specialities:", err);
    throw err;
  }
};

export const getPaymentLink = async (invoiceId: string): Promise<void> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot get.");
    return;
  }
  try {
    if (!invoiceId) {
      throw new Error("Invoice ID missing");
    }
    const res = await postData<{ checkout: any }>(
      "/fhir/v1/invoice/" + invoiceId + "/checkout-session",
    );
    const url = res.data.checkout.url;
    return url;
  } catch (err) {
    console.error("Failed to load specialities:", err);
    throw err;
  }
};
