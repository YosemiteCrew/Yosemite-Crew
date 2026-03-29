import { useEffect, useMemo, useRef } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  loadInvoicesForAppointment,
  loadInvoicesForOrgPrimaryOrg,
} from '@/app/features/billing/services/invoiceService';
import { Invoice } from '@yosemite-crew/types';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { appointmentIdsMatch } from '@/app/lib/invoice';

export const useLoadInvoicesForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const invoiceIdsByOrgId = useInvoiceStore((s) => s.invoiceIdsByOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    if (useInvoiceStore.getState().status === 'loading') return;
    if (Object.hasOwn(invoiceIdsByOrgId, primaryOrgId)) return;
    const loadInvoices = async () => {
      try {
        await loadInvoicesForOrgPrimaryOrg();
      } catch (error) {
        console.error('Failed to load invoices for organization:', error);
      }
    };
    loadInvoices();
  }, [primaryOrgId, invoiceIdsByOrgId]);
};

export const useInvoicesForPrimaryOrg = (): Invoice[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const invoicesById = useInvoiceStore((s) => s.invoicesById);

  const invoiceIdsByOrgId = useInvoiceStore((s) => s.invoiceIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = invoiceIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => invoicesById[id]).filter(Boolean);
  }, [primaryOrgId, invoicesById, invoiceIdsByOrgId]);
};

export const useInvoicesForPrimaryOrgAppointment = (
  appointmentId: string | undefined
): Invoice[] => {
  const requestedInvoiceLookupByAppointmentId = useRef<Record<string, true>>({});
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const invoicesById = useInvoiceStore((s) => s.invoicesById);

  const invoiceIdsByOrgId = useInvoiceStore((s) => s.invoiceIdsByOrgId);

  const invoices = useMemo(() => {
    if (!primaryOrgId || !appointmentId) return [];
    const ids = invoiceIdsByOrgId[primaryOrgId] ?? [];
    return ids
      .map((id) => invoicesById[id])
      .filter(
        (invoice): invoice is Invoice =>
          Boolean(invoice) && appointmentIdsMatch(invoice.appointmentId, appointmentId)
      );
  }, [primaryOrgId, invoicesById, invoiceIdsByOrgId, appointmentId]);

  useEffect(() => {
    if (!primaryOrgId || !appointmentId) return;
    if (invoices.length > 0) return;
    const lookupKey = `${primaryOrgId}:${appointmentId}`;
    if (requestedInvoiceLookupByAppointmentId.current[lookupKey]) return;
    requestedInvoiceLookupByAppointmentId.current[lookupKey] = true;

    const loadMissingAppointmentInvoices = async () => {
      try {
        await loadInvoicesForAppointment(appointmentId);
      } catch (error) {
        console.error('Failed to load invoices for appointment:', error);
      }
    };

    loadMissingAppointmentInvoices();
  }, [primaryOrgId, appointmentId, invoices.length]);

  return invoices;
};

export const usePaidInvoiceForPrimaryOrgAppointment = (
  appointmentId: string | undefined
): Invoice | undefined => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const invoicesById = useInvoiceStore((s) => s.invoicesById);
  const invoiceIdsByOrgId = useInvoiceStore((s) => s.invoiceIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId || !appointmentId) return undefined;

    const ids = invoiceIdsByOrgId[primaryOrgId] ?? [];

    return ids
      .map((id) => invoicesById[id])
      .find(
        (invoice): invoice is Invoice =>
          Boolean(invoice) &&
          appointmentIdsMatch(invoice.appointmentId, appointmentId) &&
          invoice.status === 'PAID'
      );
  }, [primaryOrgId, invoicesById, invoiceIdsByOrgId, appointmentId]);
};
