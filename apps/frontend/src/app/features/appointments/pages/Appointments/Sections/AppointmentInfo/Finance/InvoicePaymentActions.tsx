import React, { useState } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { IoClose } from 'react-icons/io5';
import {
  getPaymentLink,
  loadInvoicesForOrgPrimaryOrg,
  markInvoicePaid,
  updateInvoicePaymentCollectionMethod,
} from '@/app/features/billing/services/invoiceService';
import { Appointment } from '@yosemite-crew/types';
import { loadAppointmentsForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import { useNotify } from '@/app/hooks/useNotify';

const reloadAfterPayment = () =>
  Promise.all([
    loadInvoicesForOrgPrimaryOrg({ force: true, silent: true }),
    loadAppointmentsForPrimaryOrg({ force: true, silent: true }),
  ]);

const generatePaymentLink = async (invoiceId: string, setGeneratedLink: (url: string) => void) => {
  try {
    const url = await getPaymentLink(invoiceId);
    if (typeof url === 'string') {
      setGeneratedLink(url);
    }
  } catch (error) {
    console.log(error);
  }
};

const copyLinkToClipboard = async (generatedLink: string) => {
  try {
    await navigator.clipboard.writeText(generatedLink);
  } catch (error) {
    console.log(error);
  }
};

type NotifyFn = ReturnType<typeof useNotify>['notify'];

const collectOfflinePayment = async (
  invoiceId: string,
  setMarkingOfflinePaid: (v: boolean) => void,
  setShowCashConfirmation: (v: boolean) => void,
  notify: NotifyFn
) => {
  try {
    setMarkingOfflinePaid(true);
    await markInvoicePaid(invoiceId);
    await reloadAfterPayment();
    setShowCashConfirmation(false);
    notify('success', {
      title: 'Cash payment recorded',
      text: 'The invoice was marked paid after confirming in-person cash collection.',
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

const startCashCollection = async (
  invoiceId: string,
  setSettingCashCollectionMethod: (v: boolean) => void,
  setShowCashConfirmation: (v: boolean) => void,
  notify: NotifyFn
) => {
  try {
    setSettingCashCollectionMethod(true);
    notify('warning', {
      title: 'Confirm cash collection',
      text: 'Record cash only after you have physically received the payment from the client.',
    });
    await updateInvoicePaymentCollectionMethod(invoiceId, 'PAYMENT_AT_CLINIC');
    setShowCashConfirmation(true);
    notify('info', {
      title: 'Cash collection ready',
      text: 'Payment collection method is set to in-person cash. Click Collect cash after receiving payment.',
    });
  } catch (error) {
    console.log(error);
    notify('error', {
      title: 'Cash setup failed',
      text: 'We could not set the invoice to in-person cash collection. Please try again.',
    });
  } finally {
    setSettingCashCollectionMethod(false);
  }
};

type InvoicePaymentActionsProps = {
  invoiceId?: string;
  invoiceStatus?: string;
  paymentCollectionMethod?: string;
  stripeReceiptUrl?: string;
  activeAppointment?: Appointment;
};

type PaymentDisplayState = {
  isInvoiceSettled: boolean;
  isInPersonCashSelected: boolean;
  showOfflineCollect: boolean;
  showPaymentLinkActions: boolean;
};

const derivePaymentDisplayState = (
  invoiceStatus: string | undefined,
  paymentCollectionMethod: string | undefined,
  paymentState: string,
  stripeReceiptUrl: string | undefined,
  showCashConfirmation: boolean
): PaymentDisplayState => {
  const normalizedInvoiceStatus = String(invoiceStatus ?? '').toUpperCase();
  const normalizedPaymentCollectionMethod = String(paymentCollectionMethod ?? '').toUpperCase();
  const isInvoiceSettled =
    normalizedInvoiceStatus === 'PAID' ||
    normalizedInvoiceStatus === 'REFUNDED' ||
    normalizedInvoiceStatus === 'CANCELLED';
  const isInPersonCashSelected =
    !isInvoiceSettled &&
    (showCashConfirmation || normalizedPaymentCollectionMethod === 'PAYMENT_AT_CLINIC');
  const showOfflineCollect = !stripeReceiptUrl && !isInvoiceSettled && paymentState !== 'PAID_CASH';
  const showPaymentLinkActions = !isInPersonCashSelected && showOfflineCollect;
  return { isInvoiceSettled, isInPersonCashSelected, showOfflineCollect, showPaymentLinkActions };
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
  const { isInPersonCashSelected, showOfflineCollect, showPaymentLinkActions } =
    derivePaymentDisplayState(
      invoiceStatus,
      paymentCollectionMethod,
      paymentState,
      stripeReceiptUrl,
      showCashConfirmation
    );

  const handleGenerate = () => {
    if (invoiceId) generatePaymentLink(invoiceId, setGeneratedLink);
  };

  const handleCopy = () => {
    if (generatedLink) copyLinkToClipboard(generatedLink);
  };

  const handleDownload = () => {
    globalThis.open(stripeReceiptUrl, '_blank');
  };

  const handleCollectOfflinePayment = () => {
    if (!invoiceId || markingOfflinePaid) return;
    collectOfflinePayment(invoiceId, setMarkingOfflinePaid, setShowCashConfirmation, notify);
  };

  const handleStartCashCollection = () => {
    if (!invoiceId || markingOfflinePaid || settingCashCollectionMethod) return;
    startCashCollection(invoiceId, setSettingCashCollectionMethod, setShowCashConfirmation, notify);
  };

  if (stripeReceiptUrl) {
    return (
      <div className="flex flex-wrap justify-center gap-2">
        <Secondary text="Download" href="#" onClick={handleDownload} className="w-fit" />
      </div>
    );
  }

  return (
    <>
      {isInPersonCashSelected ? (
        <div className="rounded-2xl border border-warning-200 bg-[color-mix(in_srgb,var(--color-warning-100)_65%,white)] px-4 py-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-body-4-emphasis text-text-primary">
              Confirm cash payment before marking this invoice as paid.
            </div>
            <button
              type="button"
              aria-label="Dismiss cash confirmation"
              onClick={() => setShowCashConfirmation(false)}
              className="shrink-0 text-text-secondary hover:text-text-primary transition-colors"
            >
              <IoClose size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="text-body-4 text-text-secondary">
            Payment collection method has been set to in-person cash. Click Collect cash only after
            cash has been received from the client.
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Primary
              text={markingOfflinePaid ? 'Saving...' : 'Collect cash'}
              href="#"
              onClick={handleCollectOfflinePayment}
              isDisabled={!invoiceId || markingOfflinePaid}
              className="w-fit"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {generatedLink ? (
            <Secondary text="Copy link" href="#" onClick={handleCopy} className="w-fit" />
          ) : null}
          {showOfflineCollect ? (
            <Secondary
              text={settingCashCollectionMethod ? 'Preparing...' : 'Pay in cash'}
              href="#"
              onClick={handleStartCashCollection}
              isDisabled={!invoiceId || markingOfflinePaid || settingCashCollectionMethod}
              className="w-fit"
            />
          ) : null}
          {showPaymentLinkActions ? (
            <Secondary
              text="Generate & Mail link"
              href="#"
              onClick={handleGenerate}
              isDisabled={!invoiceId}
              className="w-fit"
            />
          ) : null}
        </div>
      )}
    </>
  );
};

export default InvoicePaymentActions;
