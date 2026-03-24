import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import React from 'react';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import Fallback from '@/app/ui/overlays/Fallback';
import { useInvoicesForPrimaryOrgAppointment } from '@/app/hooks/useInvoices';
import { Appointment } from '@yosemite-crew/types';
import { formatDateLabel } from '@/app/lib/forms';
import { getStatusStyle } from '@/app/ui/tables/InvoiceTable';
import { toTitle } from '@/app/lib/validators';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import InvoicePaymentActions from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/InvoicePaymentActions';
import { useMemo } from 'react';

type DetailsProps = {
  activeAppointment: Appointment;
};

const CASH_COLLECTION_METHOD = 'PAYMENT_AT_CLINIC';
const SETTLED_INVOICE_STATUSES = new Set(['PAID', 'REFUNDED']);

const Details = ({ activeAppointment }: DetailsProps) => {
  const currency = useCurrencyForPrimaryOrg();
  const invoices = useInvoicesForPrimaryOrgAppointment(activeAppointment.id);
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

  return (
    <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
      <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
        <div className="flex flex-col gap-6">
          {showCashRefundDisclaimer ? (
            <div className="rounded-2xl border border-[#F4D596] bg-[#FFF8E8] px-4 py-3 text-caption-1 text-text-secondary">
              This appointment was paid in cash and is now cancelled. Any refund, if applicable,
              should be handled directly by the service provider.
            </div>
          ) : null}
          {invoices.map((payment, i) => {
            return (
              <Accordion
                key={payment.appointmentId}
                title={'Invoice ' + (i + 1)}
                defaultOpen={true}
                showEditIcon={false}
                isEditing={true}
              >
                <div className="flex flex-col">
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Appointment ID: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {payment.appointmentId}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Date: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {formatDateLabel(payment.createdAt)}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light  justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Subtotal: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {formatMoney(payment.subtotal, currency)}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light  justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Discount: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {formatMoney(payment.discountTotal ?? 0, currency)}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Tax: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {formatMoney(payment.taxTotal ?? 0, currency)}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-grey-light justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Amount: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {formatMoney(payment.totalAmount, currency)}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Status: </div>
                    <div className="rounded-2xl px-4 py-2" style={getStatusStyle(payment.status)}>
                      {toTitle(payment.status)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 mt-2">
                    <InvoicePaymentActions
                      invoiceId={payment.id}
                      invoiceStatus={payment.status}
                      paymentCollectionMethod={(payment as any)?.paymentCollectionMethod}
                      stripeReceiptUrl={payment.stripeReceiptUrl}
                      activeAppointment={activeAppointment}
                    />
                  </div>
                </div>
              </Accordion>
            );
          })}
        </div>
      </div>
    </PermissionGate>
  );
};

export default Details;
