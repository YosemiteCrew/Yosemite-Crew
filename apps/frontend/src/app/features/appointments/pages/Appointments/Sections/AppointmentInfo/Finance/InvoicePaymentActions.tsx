import React, { useState } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import {
  getPaymentLink,
  loadInvoicesForOrgPrimaryOrg,
  markInvoicePaid,
  updateInvoicePaymentCollectionMethod,
} from '@/app/features/billing/services/invoiceService';
import { Appointment } from '@yosemite-crew/types';
import { loadAppointmentsForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import { useNotify } from '@/app/hooks/useNotify';

type InvoicePaymentActionsProps = {
  invoiceId?: string;
  invoiceStatus?: string;
  paymentCollectionMethod?: string;
  stripeReceiptUrl?: string;
  activeAppointment?: Appointment;
};

const InvoicePaymentActions = ({
  invoiceId,
  invoiceStatus,
  paymentCollectionMethod,
  stripeReceiptUrl,
  activeAppointment,
}: InvoicePaymentActionsProps) => {
  const { notify } = useNotify();
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [showCashConfirmation, setShowCashConfirmation] = useState(false);
  const [settingCashCollectionMethod, setSettingCashCollectionMethod] = useState(false);
  const [markingOfflinePaid, setMarkingOfflinePaid] = useState(false);
  const paymentState = String(activeAppointment?.paymentStatus ?? '').toUpperCase();
  const normalizedInvoiceStatus = String(invoiceStatus ?? '').toUpperCase();
  const normalizedPaymentCollectionMethod = String(paymentCollectionMethod ?? '').toUpperCase();
  const isCashAtClinicSelected =
    showCashConfirmation || normalizedPaymentCollectionMethod === 'PAYMENT_AT_CLINIC';
  const isInvoiceSettled =
    normalizedInvoiceStatus === 'PAID' ||
    normalizedInvoiceStatus === 'REFUNDED' ||
    normalizedInvoiceStatus === 'CANCELLED';
  const showOfflineCollect = !stripeReceiptUrl && !isInvoiceSettled && paymentState !== 'PAID_CASH';
  const showPaymentLinkActions = !isCashAtClinicSelected && showOfflineCollect;

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
      setShowCashConfirmation(false);
      notify('success', {
        title: 'Cash payment recorded',
        text: 'The invoice was marked paid after confirming cash collection at the clinic.',
      });
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Cash payment failed',
        text: 'We could not record the cash collection. Please try again.',
      });
    } finally {
      setMarkingOfflinePaid(false);
    }
  };

  const handleStartCashCollection = async () => {
    if (!invoiceId || markingOfflinePaid || settingCashCollectionMethod) return;
    try {
      setSettingCashCollectionMethod(true);
      notify('warning', {
        title: 'Confirm cash collection',
        text: 'Record cash only after you have physically received the payment at the clinic.',
      });
      await updateInvoicePaymentCollectionMethod(invoiceId, 'PAYMENT_AT_CLINIC');
      setShowCashConfirmation(true);
      notify('info', {
        title: 'Cash collection ready',
        text: 'Payment collection method is set to cash at clinic. Click Collect cash after receiving payment.',
      });
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Cash setup failed',
        text: 'We could not set the invoice to payment at clinic. Please try again.',
      });
    } finally {
      setSettingCashCollectionMethod(false);
    }
  };

  if (stripeReceiptUrl) {
    return <Secondary text="Download" href="#" onClick={handleDownload} />;
  }

  return (
    <>
      {generatedLink ? <Secondary text="Copy link" href="#" onClick={handleCopy} /> : null}
      {showOfflineCollect ? (
        <>
          {isCashAtClinicSelected ? (
            <div className="rounded-2xl border border-[#F4D596] bg-[#FFF8E8] px-4 py-4 flex flex-col gap-3">
              <div className="text-body-4-emphasis text-text-primary">
                Confirm cash payment before marking this invoice as paid.
              </div>
              <div className="text-body-4 text-text-secondary">
                Payment collection method has been set to cash at clinic. Click Collect cash only
                after cash has been received from the client.
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Primary
                  text={markingOfflinePaid ? 'Saving...' : 'Collect cash'}
                  href="#"
                  onClick={handleCollectOfflinePayment}
                  isDisabled={!invoiceId || markingOfflinePaid}
                />
              </div>
            </div>
          ) : (
            <Secondary
              text={settingCashCollectionMethod ? 'Preparing...' : 'Pay in cash'}
              href="#"
              onClick={handleStartCashCollection}
              isDisabled={!invoiceId || markingOfflinePaid || settingCashCollectionMethod}
            />
          )}
        </>
      ) : null}
      {showPaymentLinkActions ? (
        <Secondary
          text="Generate & Mail link"
          href="#"
          onClick={handleGenerate}
          isDisabled={!invoiceId}
        />
      ) : null}
    </>
  );
};

export default InvoicePaymentActions;
