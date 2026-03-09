import React, { useState } from 'react';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { getPaymentLink } from '@/app/features/billing/services/invoiceService';
import { Appointment } from '@yosemite-crew/types';
import { updateAppointmentPaymentStatus } from '@/app/features/appointments/services/appointmentService';

type InvoicePaymentActionsProps = {
  invoiceId?: string;
  stripeReceiptUrl?: string;
  activeAppointment?: Appointment;
};

const InvoicePaymentActions = ({
  invoiceId,
  stripeReceiptUrl,
  activeAppointment,
}: InvoicePaymentActionsProps) => {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [markingOfflinePaid, setMarkingOfflinePaid] = useState(false);
  const paymentState = String(activeAppointment?.paymentStatus ?? '').toUpperCase();
  const showOfflineCollect =
    !stripeReceiptUrl && paymentState !== 'PAID' && paymentState !== 'PAID_CASH';

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
    if (!activeAppointment || markingOfflinePaid) return;
    try {
      setMarkingOfflinePaid(true);
      await updateAppointmentPaymentStatus(activeAppointment, 'PAID_CASH');
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
          isDisabled={!activeAppointment?.id || markingOfflinePaid}
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
