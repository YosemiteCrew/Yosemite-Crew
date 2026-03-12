import React, { useState } from 'react';
import { Secondary } from '@/app/ui/primitives/Buttons';
import {
  getPaymentLink,
  loadInvoicesForOrgPrimaryOrg,
  markInvoicePaid,
} from '@/app/features/billing/services/invoiceService';
import { Appointment } from '@yosemite-crew/types';
import { loadAppointmentsForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';

type InvoicePaymentActionsProps = {
  invoiceId?: string;
  invoiceStatus?: string;
  stripeReceiptUrl?: string;
  activeAppointment?: Appointment;
};

const InvoicePaymentActions = ({
  invoiceId,
  invoiceStatus,
  stripeReceiptUrl,
  activeAppointment,
}: InvoicePaymentActionsProps) => {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [markingOfflinePaid, setMarkingOfflinePaid] = useState(false);
  const paymentState = String(activeAppointment?.paymentStatus ?? '').toUpperCase();
  const normalizedInvoiceStatus = String(invoiceStatus ?? '').toUpperCase();
  const showOfflineCollect =
    !stripeReceiptUrl &&
    normalizedInvoiceStatus !== 'PAID' &&
    paymentState !== 'PAID' &&
    paymentState !== 'PAID_CASH';

  const handleGenerate = async () => {
    try {
      if (!invoiceId) return;
      const url = await getPaymentLink(invoiceId);
      if (typeof url === 'string') {
        setGeneratedLink(url);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleCopy = async () => {
    try {
      if (!generatedLink) return;
      await navigator.clipboard.writeText(generatedLink);
    } catch (error) {
      console.log(error);
    }
  };

  const handleDownload = () => {
    globalThis.open(stripeReceiptUrl, '_blank');
  };

  const handleCollectOfflinePayment = async () => {
    if (!invoiceId || markingOfflinePaid) return;
    try {
      setMarkingOfflinePaid(true);
      await markInvoicePaid(invoiceId);
      await Promise.all([
        loadInvoicesForOrgPrimaryOrg({ force: true, silent: true }),
        loadAppointmentsForPrimaryOrg({ force: true, silent: true }),
      ]);
    } catch (error) {
      console.log(error);
    } finally {
      setMarkingOfflinePaid(false);
    }
  };

  if (stripeReceiptUrl) {
    return <Secondary text="Download" href="#" onClick={handleDownload} />;
  }

  return (
    <>
      {generatedLink ? <Secondary text="Copy link" href="#" onClick={handleCopy} /> : null}
      {showOfflineCollect ? (
        <Secondary
          text={markingOfflinePaid ? 'Saving...' : 'Collect payment offline'}
          href="#"
          onClick={handleCollectOfflinePayment}
          isDisabled={!invoiceId || markingOfflinePaid}
        />
      ) : null}
      <Secondary
        text="Generate & Mail link"
        href="#"
        onClick={handleGenerate}
        isDisabled={!invoiceId}
      />
    </>
  );
};

export default InvoicePaymentActions;
