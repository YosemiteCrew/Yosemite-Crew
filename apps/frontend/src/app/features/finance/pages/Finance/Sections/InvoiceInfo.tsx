'use client';
import Modal from '@/app/ui/overlays/Modal';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { getAppointmentByIdFromList } from '@/app/lib/invoice';
import { toTitle } from '@/app/lib/validators';
import { Invoice } from '@yosemite-crew/types';
import React, { useId, useMemo } from 'react';
import { getOwnerFirstName } from '@/app/lib/companionName';
import { getAppointmentCompanion } from '@/app/lib/appointments';
import { useRouter } from 'next/navigation';
import { getInvoiceStatusTone } from '@/app/ui/tables/tableUtils';
import { useParentStore } from '@/app/stores/parentStore';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';
import InvoiceDetailHeader from '@/app/features/finance/pages/Finance/Sections/InvoiceDetailHeader';
import InvoiceBilledItems from '@/app/features/finance/pages/Finance/Sections/InvoiceBilledItems';
import InvoiceSummaryPanel from '@/app/features/finance/pages/Finance/Sections/InvoiceSummaryPanel';
import InvoiceBilledTo from '@/app/features/finance/pages/Finance/Sections/InvoiceBilledTo';
import InvoicePaymentLedger from '@/app/features/finance/pages/Finance/Sections/InvoicePaymentLedger';
import InvoicePhoneRecord from '@/app/features/finance/pages/Finance/Sections/InvoicePhoneRecord';

type InvoiceInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeInvoice: Invoice | null;
};

const InvoiceInfo = ({ showModal, setShowModal, activeInvoice }: InvoiceInfoProps) => {
  const appointments = useAppointmentsForPrimaryOrg();
  const currency = useCurrencyForPrimaryOrg();
  const router = useRouter();
  const isPhone = useIsPhone();
  const titleId = useId();

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
  const invoiceStatusTone = getInvoiceStatusTone(activeInvoice?.status ?? '');

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
      {isPhone ? (
        activeInvoice && (
          <InvoicePhoneRecord
            titleId={titleId}
            invoice={activeInvoice}
            appointment={appointment}
            currency={currency}
            statusLabel={invoiceStatusLabel}
            statusTone={invoiceStatusTone}
            payerName={payerName}
            payerEmail={payerEmail}
            onClose={() => setShowModal(false)}
            onOpenAppointment={goToAppointmentFinance}
          />
        )
      ) : (
        <div className="flex flex-col flex-auto min-h-0 gap-4">
          {activeInvoice && (
            <InvoiceDetailHeader
              titleId={titleId}
              invoice={activeInvoice}
              appointment={appointment}
              statusLabel={invoiceStatusLabel}
              statusTone={invoiceStatusTone}
              onClose={() => setShowModal(false)}
              onOpenAppointment={goToAppointmentFinance}
            />
          )}

          <div className="flex overflow-y-auto flex-auto min-h-0 flex-col gap-6 scrollbar-hidden">
            {activeInvoice && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
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
          </div>
        </div>
      )}
    </Modal>
  );
};

export default InvoiceInfo;
