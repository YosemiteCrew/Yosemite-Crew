import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import React, { useMemo } from 'react';
import { FormDataProps } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo';
import Image from 'next/image';
import { Appointment } from '@yosemite-crew/types';
import { AppointmentStatusOptions } from '@/app/features/appointments/types/appointments';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import Fallback from '@/app/ui/overlays/Fallback';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import { toNumberSafe } from '@/app/lib/validators';
import { useInvoicesForPrimaryOrgAppointment } from '@/app/hooks/useInvoices';
import InvoicePaymentActions from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/InvoicePaymentActions';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { getInvoicePaymentMethodLabel } from '@/app/lib/invoicePaymentMethod';

const AppointmentFields = [
  { label: 'Service', key: 'service', type: 'text' },
  { label: 'Reason', key: 'concern', type: 'text' },
  { label: 'Date', key: 'date', type: 'date' },
  { label: 'Time', key: 'time', type: 'time' },
  { label: 'Lead', key: 'lead', type: 'text' },
  {
    label: 'Status',
    key: 'status',
    type: 'select',
    options: AppointmentStatusOptions,
  },
];

const PAYABLE_INVOICE_STATUSES = new Set(['PENDING', 'AWAITING_PAYMENT']);
const CASH_COLLECTION_METHOD = 'PAYMENT_AT_CLINIC';
const SETTLED_INVOICE_STATUSES = new Set(['PAID', 'REFUNDED']);

type SummaryProps = {
  formData: FormDataProps;
  activeAppointment: Appointment;
};

const Summary = ({ activeAppointment, formData }: SummaryProps) => {
  const currency = useCurrencyForPrimaryOrg();
  const invoices = useInvoicesForPrimaryOrgAppointment(activeAppointment.id);

  const latestInvoice = useMemo(() => {
    if (!invoices.length) return undefined;
    return [...invoices].sort((a, b) => {
      const aTime = new Date(a.createdAt ?? 0).getTime();
      const bTime = new Date(b.createdAt ?? 0).getTime();
      return bTime - aTime;
    })[0];
  }, [invoices]);

  const payableInvoice = useMemo(
    () =>
      [...invoices]
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .find((inv) => PAYABLE_INVOICE_STATUSES.has(inv.status)),
    [invoices]
  );

  const actionInvoice = payableInvoice ?? latestInvoice;

  const showCashRefundDisclaimer = useMemo(() => {
    const normalizedAppointmentStatus = String(activeAppointment.status ?? '').toUpperCase();
    if (normalizedAppointmentStatus !== 'CANCELLED') {
      return false;
    }

    const normalizedAppointmentPaymentStatus = String(
      activeAppointment.paymentStatus ?? ''
    ).toUpperCase();
    if (normalizedAppointmentPaymentStatus === 'PAID_CASH') {
      return true;
    }

    return invoices.some((invoice) => {
      const normalizedCollectionMethod = String(
        (invoice as any)?.paymentCollectionMethod ?? ''
      ).toUpperCase();
      const normalizedInvoiceStatus = String(invoice.status ?? '').toUpperCase();
      return (
        normalizedCollectionMethod === CASH_COLLECTION_METHOD &&
        (SETTLED_INVOICE_STATUSES.has(normalizedInvoiceStatus) || Boolean((invoice as any)?.paidAt))
      );
    });
  }, [activeAppointment.status, activeAppointment.paymentStatus, invoices]);

  const totals = useMemo(() => {
    if (!actionInvoice) {
      return {
        subtotal: toNumberSafe(formData.subTotal),
        discount: toNumberSafe(formData.discount),
        tax: toNumberSafe(formData.tax),
        total: toNumberSafe(formData.total),
      };
    }
    return {
      subtotal: toNumberSafe(actionInvoice.subtotal),
      discount: toNumberSafe(actionInvoice.discountTotal),
      tax: toNumberSafe(actionInvoice.taxTotal),
      total: toNumberSafe(actionInvoice.totalAmount),
    };
  }, [actionInvoice, formData.subTotal, formData.discount, formData.tax, formData.total]);

  const AppointmentInfoData = useMemo(
    () => ({
      concern: activeAppointment.concern ?? '',
      service: activeAppointment.appointmentType?.name ?? '',
      date: activeAppointment.appointmentDate ?? '',
      time: activeAppointment.startTime ?? '',
      lead: activeAppointment.lead?.name ?? '',
      status: activeAppointment.status ?? '',
    }),
    [activeAppointment]
  );

  return (
    <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
      <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
        <div className="flex flex-col gap-6">
          <EditableAccordion
            key={'Appointments-key'}
            title={'Appointments details'}
            fields={AppointmentFields}
            data={AppointmentInfoData}
            defaultOpen={true}
            showEditIcon={false}
          />
          <div className="flex flex-col px-3! py-3! rounded-2xl border border-card-border">
            <div className="flex items-center justify-between mb-3">
              <div className="text-body-1 text-text-primary">Pay</div>
              <Image
                alt={'Powered by stripe'}
                src={MEDIA_SOURCES.appointments.stripe}
                height={30}
                width={120}
              />
            </div>
            <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
              <div className="text-body-4-emphasis text-text-tertiary">Subtotal: </div>
              <div className="text-body-4 text-text-primary text-right">
                {formatMoney(totals.subtotal, currency)}
              </div>
            </div>
            <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
              <div className="text-body-4-emphasis text-text-tertiary">Discount: </div>
              <div className="text-body-4 text-text-primary text-right">
                {formatMoney(totals.discount, currency)}
              </div>
            </div>
            <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
              <div className="text-body-4-emphasis text-text-tertiary">Tax: </div>
              <div className="text-body-4 text-text-primary text-right">
                {formatMoney(totals.tax, currency)}
              </div>
            </div>
            <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
              <div className="text-body-4-emphasis text-text-tertiary">Estimated total: </div>
              <div className="text-body-4 text-text-primary text-right">
                {formatMoney(totals.total, currency)}
              </div>
            </div>
            {actionInvoice ? (
              <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
                <div className="text-body-4-emphasis text-text-tertiary">Payment method: </div>
                <div className="text-body-4 text-text-primary text-right">
                  {getInvoicePaymentMethodLabel(actionInvoice)}
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-3 mt-3">
              <InvoicePaymentActions
                invoiceId={actionInvoice?.id}
                invoiceStatus={actionInvoice?.status}
                paymentCollectionMethod={(actionInvoice as any)?.paymentCollectionMethod}
                stripeReceiptUrl={actionInvoice?.stripeReceiptUrl}
                activeAppointment={activeAppointment}
              />
            </div>
            {showCashRefundDisclaimer ? (
              <div className="rounded-2xl border border-[#F4D596] bg-[#FFF8E8] px-4 py-3 text-caption-1 text-text-secondary">
                This appointment was paid in cash and is now cancelled. Any refund, if applicable,
                should be handled directly by the service provider.
              </div>
            ) : null}
            <div className="text-caption-1 text-text-secondary py-2">
              <span className="text-[#247AED]">Note : </span>Yosemite Crew uses Stripe for secure
              payments. Your payment details are encrypted and never stored on our servers.
            </div>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
};

export default Summary;
