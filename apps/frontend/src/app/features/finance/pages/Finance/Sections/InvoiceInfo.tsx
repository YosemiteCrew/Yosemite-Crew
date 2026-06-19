'use client';
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
import { toTitle } from '@/app/lib/validators';
import { Invoice } from '@yosemite-crew/types';
import React, { useId, useMemo, useState } from 'react';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';
import { getAppointmentCompanion } from '@/app/lib/appointments';
import InvoicePaymentActions from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Finance/InvoicePaymentActions';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import Image from 'next/image';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { getInvoiceStatusStyle } from '@/app/ui/tables/tableUtils';

type ActiveTab = 'details' | 'payment';

const tabs: { key: ActiveTab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'payment', label: 'Payment' },
];

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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('details');
  const titleId = useId();
  const detailsTabId = useId();
  const paymentTabId = useId();
  const detailsPanelId = useId();
  const paymentPanelId = useId();

  const appointment = useMemo(
    () => getAppointmentByIdFromList(appointments, activeInvoice?.appointmentId),
    [appointments, activeInvoice]
  );

  const invoiceStatusLabel = toTitle(activeInvoice?.status ?? '');
  const invoiceStatusStyle = (() => {
    const s = getInvoiceStatusStyle(activeInvoice?.status ?? '');
    return { ...s, borderColor: s.color };
  })();

  const appointmentInfoData = useMemo(() => {
    if (appointment) {
      return {
        pet: formatCompanionNameWithOwnerLastName(
          getAppointmentCompanion(appointment).name,
          getAppointmentCompanion(appointment).parent
        ),
        parent: getOwnerFirstName(getAppointmentCompanion(appointment).parent) || '-',
        service: appointment.appointmentType?.name,
      };
    }
    return { pet: '-', parent: '-', service: '-' };
  }, [appointment]);

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

  const goToAppointmentFinance = () => {
    if (!appointment?.id) return;
    const params = new URLSearchParams({
      appointmentId: appointment.id,
      open: 'finance',
      subLabel: 'summary',
    });
    router.push(`/appointments?${params.toString()}`);
    setShowModal(false);
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="opacity-0 pointer-events-none">
            <Close onClick={() => {}} />
          </div>
          <h2 id={titleId} className="text-body-1 text-text-primary">
            View invoice
          </h2>
          <Close onClick={() => setShowModal(false)} />
        </div>

        {/* Tab pills */}
        <div
          className="flex items-center justify-center gap-2 border-b border-card-border pb-3"
          role="tablist"
          aria-label="Invoice detail sections"
          aria-labelledby={titleId}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              id={tab.key === 'details' ? detailsTabId : paymentTabId}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={tab.key === 'details' ? detailsPanelId : paymentPanelId}
              tabIndex={activeTab === tab.key ? 0 : -1}
              className={clsx(
                'h-9 px-4 rounded-2xl! text-body-4 transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-blue-light text-blue-text!'
                  : 'text-text-tertiary hover:bg-card-hover!'
              )}
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor:
                  activeTab === tab.key ? 'var(--color-text-brand)' : 'var(--color-card-border)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex overflow-y-auto flex-1 flex-col gap-6 scrollbar-hidden">
          {activeTab === 'details' && (
            <div
              id={detailsPanelId}
              role="tabpanel"
              aria-labelledby={detailsTabId}
              className="flex flex-col gap-6"
            >
              <EditableAccordion
                key="Appointments-key"
                title="Appointment details"
                fields={CompanionFields}
                data={appointmentInfoData}
                defaultOpen={true}
                showEditIcon={false}
                rightElement={
                  invoiceStatusLabel ? (
                    <span
                      className="rounded-2xl px-3 py-0.5 text-caption-1 border"
                      style={invoiceStatusStyle}
                    >
                      {invoiceStatusLabel}
                    </span>
                  ) : undefined
                }
              />
              <EditableAccordion
                key="Payments-key"
                title="Payment details"
                fields={InvoiceFields}
                data={paymentInfoData}
                defaultOpen={true}
                showEditIcon={false}
              />
              {appointment && (
                <div className="flex justify-center">
                  <Secondary
                    text="Open in appointments"
                    href="#"
                    onClick={goToAppointmentFinance}
                    className="w-fit"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'payment' && (
            <div
              id={paymentPanelId}
              role="tabpanel"
              aria-labelledby={paymentTabId}
              className="flex flex-col gap-6 w-full flex-1 justify-between"
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col px-3! py-3! rounded-2xl border border-card-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-body-2 text-text-primary">Pay</div>
                    <Image
                      alt="Powered by stripe"
                      src={MEDIA_SOURCES.appointments.stripe}
                      height={30}
                      width={120}
                    />
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Subtotal: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {paymentInfoData.subTotal}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Discount: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {paymentInfoData.discount}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Tax: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {paymentInfoData.tax}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Estimated total: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {paymentInfoData.total}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Payment method: </div>
                    <div className="text-body-4 text-text-primary text-right">
                      {paymentInfoData.paymentMethod}
                    </div>
                  </div>
                  <div className="py-2! flex items-center gap-2 border-b border-card-border justify-between">
                    <div className="text-body-4-emphasis text-text-tertiary">Status: </div>
                    <span
                      className="rounded-2xl px-3 py-0.5 text-caption-1 border"
                      style={invoiceStatusStyle}
                    >
                      {invoiceStatusLabel || '-'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 mt-3">
                    <InvoicePaymentActions
                      invoiceId={activeInvoice?.id}
                      invoiceStatus={activeInvoice?.status}
                      paymentCollectionMethod={(activeInvoice as any)?.paymentCollectionMethod}
                      stripeReceiptUrl={activeInvoice?.stripeReceiptUrl}
                      activeAppointment={appointment}
                    />
                  </div>
                  <div className="text-caption-1 text-text-secondary py-2">
                    <span className="text-blue-text">Note : </span>Yosemite Crew uses Stripe for
                    secure payments. Your payment details are encrypted and never stored on our
                    servers.
                  </div>
                </div>
                {appointment && (
                  <div className="flex justify-center">
                    <Secondary
                      text="Open in appointments"
                      href="#"
                      onClick={goToAppointmentFinance}
                      className="w-fit"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceInfo;
