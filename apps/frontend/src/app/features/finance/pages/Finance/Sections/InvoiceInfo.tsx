'use client';
import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
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
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import { useParentStore } from '@/app/stores/parentStore';
import InvoiceDetailHeader from '@/app/features/finance/pages/Finance/Sections/InvoiceDetailHeader';
import InvoiceBilledItems from '@/app/features/finance/pages/Finance/Sections/InvoiceBilledItems';
import InvoiceSummaryPanel from '@/app/features/finance/pages/Finance/Sections/InvoiceSummaryPanel';
import InvoiceBilledTo from '@/app/features/finance/pages/Finance/Sections/InvoiceBilledTo';
import InvoicePaymentLedger from '@/app/features/finance/pages/Finance/Sections/InvoicePaymentLedger';

type ActiveTab = 'details' | 'payment';

const tabs: { key: ActiveTab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'payment', label: 'Payment' },
];

const InvoiceFields = [
  { label: 'Subtotal', key: 'subTotal', type: 'text' },
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
  const terminologyText = useCompanionTerminologyText();
  const appointments = useAppointmentsForPrimaryOrg();
  const currency = useCurrencyForPrimaryOrg();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('details');
  const titleId = useId();
  const detailsTabId = useId();
  const paymentTabId = useId();
  const detailsPanelId = useId();
  const paymentPanelId = useId();
  const companionFields = useMemo(
    () => [
      { label: terminologyText('Pet'), key: 'pet', type: 'text' },
      { label: 'Parent', key: 'parent', type: 'text' },
      { label: 'Service', key: 'service', type: 'text' },
    ],
    [terminologyText]
  );

  const appointment = useMemo(
    () => getAppointmentByIdFromList(appointments, activeInvoice?.appointmentId),
    [appointments, activeInvoice]
  );

  const parentId = useMemo(() => {
    if (activeInvoice?.parentId) return activeInvoice.parentId;
    if (appointment) return getAppointmentCompanion(appointment).parent.id;
    return undefined;
  }, [activeInvoice, appointment]);

  const storedParent = useParentStore((state) => (parentId ? state.getParentById(parentId) : null));

  const payerName = useMemo(() => {
    if (storedParent) {
      const composed = [storedParent.firstName, storedParent.lastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ');
      if (composed) return composed;
    }
    if (appointment) return getOwnerFirstName(getAppointmentCompanion(appointment).parent);
    return '';
  }, [storedParent, appointment]);

  const payerEmail = storedParent?.email ?? '';

  const invoiceStatusLabel = toTitle(activeInvoice?.status ?? '');
  const invoiceStatusStyle = getInvoiceStatusStyle(activeInvoice?.status ?? '');

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
    <Modal
      showModal={showModal}
      setShowModal={setShowModal}
      variant="centered"
      size="lg"
      aria-labelledby={titleId}
    >
      <div className="flex flex-col flex-auto min-h-0 gap-4">
        {/* Header */}
        {activeInvoice && (
          <InvoiceDetailHeader
            titleId={titleId}
            invoice={activeInvoice}
            appointment={appointment}
            statusLabel={invoiceStatusLabel}
            statusStyle={invoiceStatusStyle}
            onClose={() => setShowModal(false)}
            onOpenAppointment={goToAppointmentFinance}
          />
        )}

        {/* Segmented tab control */}
        <div className="flex justify-center">
          <div
            className="inline-flex items-center gap-1 rounded-full! p-[3px] bg-[var(--inset)]"
            role="tablist"
            aria-label="Invoice detail sections"
            aria-labelledby={titleId}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  id={tab.key === 'details' ? detailsTabId : paymentTabId}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={tab.key === 'details' ? detailsPanelId : paymentPanelId}
                  tabIndex={isActive ? 0 : -1}
                  className={clsx(
                    'h-8 px-5 rounded-full! text-body-4 transition-all duration-200',
                    isActive
                      ? 'bg-[var(--screen)] text-text-primary shadow-[0_1px_2px_var(--sh06),0_2px_6px_var(--sh10)]'
                      : 'text-text-tertiary hover:text-text-primary'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex overflow-y-auto flex-auto min-h-0 flex-col gap-6 scrollbar-hidden">
          {activeTab === 'details' && (
            <div
              id={detailsPanelId}
              role="tabpanel"
              aria-labelledby={detailsTabId}
              className="flex flex-col gap-6"
            >
              {activeInvoice && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.7fr_1fr] lg:items-start">
                  <div className="flex flex-col gap-5">
                    <InvoiceBilledItems items={activeInvoice.items ?? []} currency={currency} />
                    <InvoicePaymentLedger
                      invoice={activeInvoice}
                      currency={currency}
                      payerName={payerName}
                      payerEmail={payerEmail}
                    />
                  </div>
                  <div className="flex flex-col gap-5">
                    <InvoiceSummaryPanel invoice={activeInvoice} currency={currency} />
                    <InvoiceBilledTo parentId={parentId} appointment={appointment} />
                  </div>
                </div>
              )}
              <EditableAccordion
                key="Appointments-key"
                title="Appointment details"
                fields={companionFields}
                data={appointmentInfoData}
                defaultOpen={true}
                showEditIcon={false}
                rightElement={
                  invoiceStatusLabel ? (
                    <span
                      className="rounded-full px-3 py-0.5 text-caption-1 border"
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
            </div>
          )}

          {activeTab === 'payment' && (
            <div
              id={paymentPanelId}
              role="tabpanel"
              aria-labelledby={paymentTabId}
              className="flex w-full flex-1 flex-col gap-5"
            >
              <section
                className="flex flex-col gap-4 rounded-[14px] border border-card-border px-4.5 py-4"
                aria-label="Collect payment"
              >
                <div className="flex items-center justify-between">
                  <span className="text-body-4-emphasis text-text-primary">Pay</span>
                  <Image
                    alt="Powered by stripe"
                    src={MEDIA_SOURCES.appointments.stripe}
                    height={28}
                    width={112}
                  />
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-body-4 text-text-tertiary">
                    <span>Subtotal</span>
                    <span className="tabular-nums text-body-4-emphasis text-text-secondary">
                      {paymentInfoData.subTotal}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-body-4 text-text-tertiary">
                    <span>Discount</span>
                    <span className="tabular-nums text-body-4-emphasis text-text-secondary">
                      {paymentInfoData.discount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-body-4 text-text-tertiary">
                    <span>Tax</span>
                    <span className="tabular-nums text-body-4-emphasis text-text-secondary">
                      {paymentInfoData.tax}
                    </span>
                  </div>
                  <span className="h-px bg-card-border" aria-hidden="true" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-body-3-emphasis text-text-primary">Estimated total</span>
                    <span className="text-heading-2 tabular-nums text-text-primary">
                      {paymentInfoData.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-body-4 text-text-tertiary">
                    <span>Payment method</span>
                    <span className="tabular-nums text-body-4-emphasis text-text-secondary text-right">
                      {paymentInfoData.paymentMethod}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-body-4 text-text-tertiary">
                    <span>Status</span>
                    <span
                      className="shrink-0 rounded-full border px-2.5 py-0.5 text-caption-2"
                      style={invoiceStatusStyle}
                    >
                      {invoiceStatusLabel || '-'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <InvoicePaymentActions
                    invoiceId={activeInvoice?.id}
                    invoiceStatus={activeInvoice?.status}
                    paymentCollectionMethod={(activeInvoice as any)?.paymentCollectionMethod}
                    stripeReceiptUrl={activeInvoice?.stripeReceiptUrl}
                    activeAppointment={appointment}
                  />
                </div>
                <div className="text-caption-1 text-text-secondary">
                  <span className="text-blue-text">Note : </span>Yosemite Crew uses Stripe for
                  secure payments. Your payment details are encrypted and never stored on our
                  servers.
                </div>
              </section>
              {activeInvoice && (
                <InvoicePaymentLedger
                  invoice={activeInvoice}
                  currency={currency}
                  payerName={payerName}
                  payerEmail={payerEmail}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceInfo;
