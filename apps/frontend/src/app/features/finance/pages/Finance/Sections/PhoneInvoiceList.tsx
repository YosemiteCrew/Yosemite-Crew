'use client';
import React, { useMemo } from 'react';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import CompanionAvatar from '@/app/ui/avatars/CompanionAvatar';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { StatusOption } from '@/app/features/companions/pages/Companions/types';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { formatMoneyPrecise, recordCurrency } from '@/app/lib/money';
import { formatDateLabel } from '@/app/lib/forms';
import { toTitle } from '@/app/lib/validators';
import {
  getInvoiceNumberLabel,
  getAppointmentByIdFromList,
  getCompanionNameFromAppointments,
  getParentNameFromAppointments,
} from '@/app/lib/invoice';
import { getInvoicePaymentMethodLabel } from '@/app/lib/invoicePaymentMethod';
import { getInvoiceStatusTone } from '@/app/ui/tables/tableUtils';
import { getInvoiceOutstanding, type FinanceMetrics } from '@/app/lib/financeMetrics';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanion, getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import InvoiceStatusFilterPills from '@/app/features/finance/pages/Finance/Sections/InvoiceStatusFilterPills';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { useCompanionStore } from '@/app/stores/companionStore';

type PhoneInvoiceListProps = {
  filteredList: Invoice[];
  statusOptions: StatusOption[];
  activeStatus: string;
  setActiveStatus: (value: string) => void;
  metrics: FinanceMetrics;
  currency: string;
  /**
   * The currency for the KPI totals.
   *
   * Separate from `currency` because `metrics` is computed over EVERY invoice
   * while `filteredList` is the visible subset - deriving it here would label a
   * total with the currency of a different set of invoices to the one it sums.
   */
  metricsCurrency: string;
  onViewInvoice: (invoice: Invoice) => void;
};

const CARD_SHADOW = 'shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]';

const buildOwnerAndCompanion = (parentName: string, companionName: string): string => {
  if (parentName !== '-' && companionName !== '-') return `${parentName} / ${companionName}`;
  if (parentName !== '-') return parentName;
  if (companionName !== '-') return companionName;
  return '';
};

const buildFootnote = (invoice: Invoice, currency: string): string => {
  const deposit = invoice.depositCollectedAmount ?? 0;
  if (deposit > 0)
    return `Deposit ${formatMoneyPrecise(deposit, recordCurrency(invoice, currency))} applied`;
  if (getInvoiceOutstanding(invoice) === 0) {
    const method = getInvoicePaymentMethodLabel(invoice);
    if (method && method !== '-') return method;
  }
  return '';
};

type PhoneInvoiceCardProps = {
  invoice: Invoice;
  appointment?: Appointment;
  ownerAndCompanion: string;
  currency: string;
  onView: (invoice: Invoice) => void;
};

const PhoneInvoiceCard = ({
  invoice,
  appointment,
  ownerAndCompanion,
  currency,
  onView,
}: PhoneInvoiceCardProps) => {
  const companion = appointment ? getAppointmentCompanion(appointment) : undefined;
  const avatarSrc = getSafeImageUrl(
    getAppointmentCompanionPhotoUrl(companion),
    (companion?.species as ImageType) ?? 'other'
  );
  const service = appointment?.appointmentType?.name?.trim();
  const identityLine = [ownerAndCompanion, service].filter(Boolean).join(' · ');
  const numberLabel = getInvoiceNumberLabel(invoice) || 'Invoice';
  const dateLabel = formatDateLabel(invoice.createdAt);
  const statusLabel = toTitle(invoice.status ?? '');
  const outstanding = getInvoiceOutstanding(invoice);
  const isUnpaid = outstanding > 0 && (invoice.depositCollectedAmount ?? 0) === 0;
  const footnote = buildFootnote(invoice, currency);

  return (
    <button
      type="button"
      onClick={() => onView(invoice)}
      aria-label={`View invoice ${numberLabel}`}
      className={`w-full text-left flex flex-col gap-[7px] rounded-2xl bg-[var(--screen)] px-3.5 py-3 border ${
        isUnpaid
          ? 'border-[var(--warn-border)] border-l-[3px] border-l-[var(--warn)]'
          : 'border-[var(--hairline)]'
      } ${CARD_SHADOW}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-bold tabular-nums text-[var(--ink)]">
          {numberLabel}
          {dateLabel && (
            <span className="ml-1 text-[11.5px] font-medium text-[var(--ink-faint)]">
              · {dateLabel}
            </span>
          )}
        </span>
        {statusLabel && (
          <StatusPill label={statusLabel} tone={getInvoiceStatusTone(invoice.status)} />
        )}
      </span>
      <span className="flex items-center gap-2.5">
        <span className="flex size-[30px] shrink-0 overflow-hidden rounded-full bg-card-hover">
          <AvatarImage
            src={avatarSrc}
            alt=""
            size={30}
            className="size-[30px] rounded-full object-cover"
            fallback={
              <CompanionAvatar
                name={companion?.name}
                seed={companion?.id}
                size={30}
                textClassName="text-[13px]"
              />
            }
          />
        </span>
        <span
          className="flex-1 min-w-0 truncate text-[12px] text-[var(--ink-muted)]"
          title={identityLine}
        >
          {identityLine || 'Unlinked invoice'}
        </span>
        <span className="shrink-0 text-[14px] font-bold tabular-nums text-[var(--ink)]">
          {formatMoneyPrecise(invoice.totalAmount ?? 0, recordCurrency(invoice, currency))}
        </span>
      </span>
      {footnote && <span className="text-[11px] text-[var(--ink-faint)]">{footnote}</span>}
    </button>
  );
};

/**
 * The phone (< 768px) form of the finance invoices screen, per the responsive
 * design: two KPI stat tiles (Collected this week / Outstanding in --warn-text),
 * the inline status filter pills, then a scrolling stack of compact three-line
 * invoice cards. Tapping a card opens the invoice record sheet; unpaid invoices
 * carry the design's --warn left-border. Replaces the legacy stacked
 * label:value InvoiceCard that the shared table renders below md.
 */
const PhoneInvoiceList = ({
  filteredList,
  statusOptions,
  activeStatus,
  setActiveStatus,
  metrics,
  currency,
  metricsCurrency,
  onViewInvoice,
}: PhoneInvoiceListProps) => {
  const appointments = useAppointmentsForPrimaryOrg();
  const companionsById = useCompanionStore((state) => state.companionsById);

  const cards = useMemo(
    () =>
      filteredList.map((invoice) => {
        const appointment = getAppointmentByIdFromList(appointments, invoice.appointmentId);
        const parentName = getParentNameFromAppointments(appointments, invoice.appointmentId);
        // An invoice converted from an estimate carries patientId and no
        // appointmentId, so the appointment lookup finds nothing and the card
        // would read "Unlinked invoice" for a perfectly well known patient.
        const fromAppointments = getCompanionNameFromAppointments(
          appointments,
          invoice.appointmentId
        );
        const fromPatient = invoice.patientId ? companionsById[invoice.patientId]?.name : undefined;
        const companionName =
          fromAppointments === '-' && fromPatient ? fromPatient : fromAppointments;
        return {
          invoice,
          appointment,
          ownerAndCompanion: buildOwnerAndCompanion(parentName, companionName),
        };
      }),
    [filteredList, appointments, companionsById]
  );

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="grid grid-cols-2 gap-2.5">
        <div
          className={`rounded-[14px] bg-[var(--screen)] border border-[var(--hairline)] px-3.5 py-3 ${CARD_SHADOW}`}
        >
          <span className="block text-[10.5px] text-[var(--ink-faint)]">Collected · wk</span>
          <span className="block text-[18px] font-bold tabular-nums tracking-[-0.03em] text-[var(--ink)]">
            {formatMoneyPrecise(metrics.collectedThisWeek, metricsCurrency)}
          </span>
        </div>
        <div
          className={`rounded-[14px] bg-[var(--screen)] border border-[var(--hairline)] px-3.5 py-3 ${CARD_SHADOW}`}
        >
          <span className="block text-[10.5px] text-[var(--ink-faint)]">Outstanding</span>
          <span className="block text-[18px] font-bold tabular-nums tracking-[-0.03em] text-[var(--warn-text)]">
            {formatMoneyPrecise(metrics.outstanding, metricsCurrency)}
          </span>
        </div>
      </div>

      <div className="-mx-0.5 overflow-x-auto scrollbar-hidden">
        <InvoiceStatusFilterPills
          options={statusOptions}
          activeStatus={activeStatus}
          setActiveStatus={setActiveStatus}
          size="md"
          className="px-0.5"
        />
      </div>

      {filteredList.length === 0 ? (
        <output
          className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary"
          aria-live="polite"
        >
          No invoices match the current filters.
        </output>
      ) : (
        <div className="flex flex-col gap-2.5">
          {cards.map(({ invoice, appointment, ownerAndCompanion }, index) => (
            <PhoneInvoiceCard
              key={invoice.id ?? `invoice-${index}`}
              invoice={invoice}
              appointment={appointment}
              ownerAndCompanion={ownerAndCompanion}
              currency={currency}
              onView={onViewInvoice}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PhoneInvoiceList;
