import React, { useMemo } from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { getInvoiceItemNames, getInvoiceStatusTone } from '@/app/ui/tables/tableUtils';
import { Invoice } from '@yosemite-crew/types';
import { formatDateLabel } from '@/app/lib/forms';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { toTitle } from '@/app/lib/validators';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoneyPrecise, recordCurrency } from '@/app/lib/money';
import { getCompanionNameFromAppointments, getParentNameFromAppointments } from '@/app/lib/invoice';
import { getInvoicePaymentMethodLabel } from '@/app/lib/invoicePaymentMethod';

type InvoiceCardProps = {
  invoice: Invoice;
  handleViewInvoice: any;
};

const InvoiceCard = ({ invoice, handleViewInvoice }: InvoiceCardProps) => {
  const appointments = useAppointmentsForPrimaryOrg();
  const orgCurrency = useCurrencyForPrimaryOrg();
  // Resolved once: every figure on this card belongs to the same invoice.
  const money = recordCurrency(invoice, orgCurrency);

  const companionName = useMemo(
    () => getCompanionNameFromAppointments(appointments, invoice.appointmentId),
    [appointments, invoice.appointmentId]
  );

  const parentName = useMemo(
    () => getParentNameFromAppointments(appointments, invoice.appointmentId),
    [appointments, invoice.appointmentId]
  );

  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] p-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">{companionName}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Parent:</div>
        <div className="text-caption-1 text-text-primary">{parentName}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Service:</div>
        <div className="text-caption-1 text-text-primary">{getInvoiceItemNames(invoice.items)}</div>
      </div>
      {/* Was "Date", the same label the desktop table put over the APPOINTMENT
          date, so an invoice raised days after the visit showed two different
          dates under one word depending on window width. This is the invoice's
          own date; the table's column is headed "Appointment". */}
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Invoice date:</div>
        <div className="text-caption-1 text-text-primary">{formatDateLabel(invoice.createdAt)}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Sub-total:</div>
        <div className="text-caption-1 text-text-primary">
          {formatMoneyPrecise(invoice.subtotal, money)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Discount:</div>
        <div className="text-caption-1 text-text-primary">
          {formatMoneyPrecise(invoice.discountTotal ?? 0, money)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Tax:</div>
        <div className="text-caption-1 text-text-primary">
          {formatMoneyPrecise(invoice.taxTotal ?? 0, money)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Total:</div>
        <div className="text-caption-1 text-text-primary">
          {formatMoneyPrecise(invoice.totalAmount, money)}
        </div>
      </div>
      <StatusPill tone={getInvoiceStatusTone(invoice.status)} label={toTitle(invoice?.status)} />
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Payment:</div>
        <div className="text-caption-1 text-text-primary">
          {getInvoicePaymentMethodLabel(invoice)}
        </div>
      </div>
      <div className="flex gap-3 w-full">
        <Secondary
          href="#"
          onClick={() => handleViewInvoice(invoice)}
          text="View"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default InvoiceCard;
