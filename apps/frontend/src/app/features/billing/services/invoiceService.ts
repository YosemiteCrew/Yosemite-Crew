import { fromInvoiceRequestDTO, InvoiceItem, InvoiceResponseDTO } from '@yosemite-crew/types';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { getData, patchData, postData } from '@/app/services/axios';

export type InvoicePaymentCollectionMethod = 'PAYMENT_AT_CLINIC';

const APPOINTMENT_ID_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/appointment-id';

const normalizeReferenceTail = (value: unknown): string | undefined => {
  let raw = '';
  if (typeof value === 'string') {
    raw = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    raw = String(value);
  }
  const normalizedRaw = raw.trim();
  if (!normalizedRaw) return undefined;
  const withoutQuery = normalizedRaw.split(/[?#]/)[0];
  const tail = withoutQuery.split('/').findLast(Boolean)?.trim();
  return tail || undefined;
};

const getInvoiceAppointmentIdFallback = (fhirInvoice: InvoiceResponseDTO): string | undefined => {
  const invoice = fhirInvoice as any;
  const extensions = Array.isArray(invoice?.extension) ? invoice.extension : [];
  const appointmentIdFromExtension = extensions.find(
    (ext: any) => String(ext?.url ?? '') === APPOINTMENT_ID_EXTENSION_URL
  )?.valueString;
  const appointmentIdFromAccount = normalizeReferenceTail(invoice?.account?.reference);
  const appointmentIdFromRawField = normalizeReferenceTail(invoice?.appointmentId);

  return (
    normalizeReferenceTail(appointmentIdFromExtension) ??
    appointmentIdFromAccount ??
    appointmentIdFromRawField
  );
};

const normalizeInvoiceForFrontend = (
  fhirInvoice: InvoiceResponseDTO,
  fallbackOrganisationId?: string
) => {
  const parsedInvoice = fromInvoiceRequestDTO(fhirInvoice);
  const resolvedAppointmentId =
    String(parsedInvoice?.appointmentId ?? '').trim() ||
    getInvoiceAppointmentIdFallback(fhirInvoice);
  const resolvedOrganisationId =
    String(parsedInvoice?.organisationId ?? '').trim() || fallbackOrganisationId;

  return {
    ...parsedInvoice,
    appointmentId: resolvedAppointmentId || parsedInvoice.appointmentId,
    organisationId: resolvedOrganisationId || parsedInvoice.organisationId,
  };
};

export const loadInvoicesForOrgPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, setInvoicesForOrg } = useInvoiceStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load specialities.');
    return;
  }
  if (!shouldFetchInvoices(status, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const res = await getData<InvoiceResponseDTO[]>(
      '/fhir/v1/invoice/organisation/' + primaryOrgId + '/list'
    );
    const invoices = res.data.map((fhirInvoice) =>
      normalizeInvoiceForFrontend(fhirInvoice, primaryOrgId)
    );
    setInvoicesForOrg(primaryOrgId, invoices);
  } catch (err) {
    console.error('Failed to load specialities:', err);
    throw err;
  }
};

export const loadInvoicesForAppointment = async (appointmentId: string): Promise<void> => {
  const { upsertInvoice } = useInvoiceStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load appointment invoices.');
    return;
  }
  if (!appointmentId) {
    console.warn('No appointment id provided. Cannot load appointment invoices.');
    return;
  }

  try {
    const res = await postData<InvoiceResponseDTO[]>(
      `/fhir/v1/invoice/appointment/${appointmentId}`,
      {}
    );
    const invoices = (res.data ?? []).map((fhirInvoice) =>
      normalizeInvoiceForFrontend(fhirInvoice, primaryOrgId)
    );
    invoices.forEach((invoice) => {
      upsertInvoice(invoice);
    });
  } catch (err) {
    console.error('Failed to load appointment invoices:', err);
    throw err;
  }
};

const shouldFetchInvoices = (
  status: ReturnType<typeof useInvoiceStore.getState>['status'],
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  return status === 'idle' || status === 'error';
};

export const addLineItemsToAppointments = async (
  lineItems: InvoiceItem[],
  appointmentId: string,
  currency: string
): Promise<void> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot add.');
    return;
  }
  try {
    if (!appointmentId || lineItems.length <= 0 || !currency) {
      throw new Error('Line items or Appointment ID or Currency missing');
    }
    const body = {
      items: lineItems,
      currency: currency.toLowerCase(),
    };
    await postData<InvoiceResponseDTO[]>(
      '/fhir/v1/invoice/appointment/' + appointmentId + '/charges',
      body
    );
  } catch (err) {
    console.error('Failed to load specialities:', err);
    throw err;
  }
};

export const getPaymentLink = async (invoiceId: string): Promise<void> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot get.');
    return;
  }
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID missing');
    }
    const res = await postData<{ checkout: any }>(
      '/fhir/v1/invoice/' + invoiceId + '/checkout-session'
    );
    const url = res.data.checkout.url;
    return url;
  } catch (err) {
    console.error('Failed to load specialities:', err);
    throw err;
  }
};

export const markInvoicePaid = async (invoiceId: string) => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot mark paid.');
    return;
  }
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID missing');
    }
    return await postData(`/fhir/v1/invoice/${invoiceId}/mark-paid`, {});
  } catch (err) {
    console.error('Failed to mark invoice paid:', err);
    throw err;
  }
};

export const updateInvoicePaymentCollectionMethod = async (
  invoiceId: string,
  paymentCollectionMethod: InvoicePaymentCollectionMethod
) => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot update payment collection method.');
    return;
  }
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID missing');
    }
    return await patchData(`/fhir/v1/invoice/${invoiceId}/payment-collection-method`, {
      paymentCollectionMethod,
    });
  } catch (err) {
    console.error('Failed to update invoice payment collection method:', err);
    throw err;
  }
};
