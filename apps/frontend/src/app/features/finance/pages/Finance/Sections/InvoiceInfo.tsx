import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import { Secondary } from '@/app/ui/primitives/Buttons';
import Close from '@/app/ui/primitives/Icons/Close';
import Modal from '@/app/ui/overlays/Modal';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatDateLabel } from '@/app/lib/forms';
import { formatMoney } from '@/app/lib/money';
import { getAppointmentByIdFromList } from '@/app/lib/invoice';
import { getInvoicePaymentMethodLabel } from '@/app/lib/invoicePaymentMethod';
import { Invoice } from '@yosemite-crew/types';
import React, { useMemo } from 'react';

const CompanionFields = [
  { label: 'Pet', key: 'pet', type: 'text' },
  { label: 'Parent', key: 'parent', type: 'text' },
  { label: 'Service', key: 'service', type: 'text' },
];
const InvoiceFields = [
  { label: 'Sub-total', key: 'subTotal', type: 'text' },
  { label: 'Discount', key: 'discount', type: 'text' },
  { label: 'Tax', key: 'tax', type: 'text' },
  { label: 'Total', key: 'total', type: 'text' },
  { label: 'Date', key: 'date', type: 'text' },
  { label: 'Payment', key: 'paymentMethod', type: 'text' },
];

type InvoiceInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeInvoice: Invoice | null;
};

const InvoiceInfo = ({ showModal, setShowModal, activeInvoice }: InvoiceInfoProps) => {
  const appointments = useAppointmentsForPrimaryOrg();
  const currency = useCurrencyForPrimaryOrg();

  const handleDownload = (link: string | undefined) => {
    globalThis.open(link, '_blank');
  };

  const appointmentInfoData = useMemo(() => {
    const appointment = getAppointmentByIdFromList(appointments, activeInvoice?.appointmentId);
    if (appointment) {
      return {
        pet: appointment.companion.name,
        parent: appointment.companion.parent.name,
        service: appointment.appointmentType?.name,
      };
    }
    return {
      pet: '-',
      parent: '-',
      service: '-',
    };
  }, [activeInvoice, appointments]);

  const paymentInfoData = useMemo(
    () => ({
      subTotal: formatMoney(activeInvoice?.subtotal ?? 0, currency),
      discount: formatMoney(activeInvoice?.discountTotal ?? 0, currency),
      tax: formatMoney(activeInvoice?.taxTotal ?? 0, currency),
      total: formatMoney(activeInvoice?.totalAmount ?? 0, currency),
      date: formatDateLabel(activeInvoice?.createdAt),
      paymentMethod: getInvoicePaymentMethodLabel(activeInvoice),
    }),
    [activeInvoice, currency]
  );

  const paymentCollectionMethod = String(
    (activeInvoice as any)?.paymentCollectionMethod ?? ''
  ).toUpperCase();
  const showDownload = Boolean(activeInvoice?.stripeReceiptUrl);
  const showGenerateLink =
    !showDownload &&
    paymentCollectionMethod !== 'PAYMENT_AT_CLINIC' &&
    activeInvoice?.status !== 'PAID';

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">View invoice</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>
        <div className="flex overflow-y-auto flex-1 justify-between flex-col gap-6 w-full scrollbar-hidden">
          <div className="flex flex-col gap-6 w-full">
            <EditableAccordion
              key={'Appointments-key'}
              title={'Appointments details'}
              fields={CompanionFields}
              data={appointmentInfoData}
              defaultOpen={true}
              showEditIcon={false}
            />
            <EditableAccordion
              key={'Payments-key'}
              title={'Payment details'}
              fields={InvoiceFields}
              data={paymentInfoData}
              defaultOpen={true}
              showEditIcon={false}
            />
          </div>
          <div className="flex flex-col gap-3 mt-2">
            {showDownload && (
              <Secondary
                text="Download"
                href=""
                onClick={() => handleDownload(activeInvoice?.stripeReceiptUrl)}
              />
            )}
            {!showDownload && showGenerateLink && (
              <div className="text-caption-1 text-text-secondary">
                Payment link actions are available from the appointment finance flow.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceInfo;
