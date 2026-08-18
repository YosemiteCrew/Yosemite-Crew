import React, { useMemo } from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import Image from 'next/image';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { IoEye, IoOpenOutline } from 'react-icons/io5';
import InvoiceCard from '@/app/ui/cards/InvoiceCard';
import { Invoice } from '@yosemite-crew/types';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { toTitle } from '@/app/lib/validators';
import { useRouter } from 'next/navigation';

import './DataTable.css';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import {
  getAppointmentByIdFromList,
  getCompanionNameFromAppointments,
  getInvoiceNumberLabel,
  getParentNameFromAppointments,
} from '@/app/lib/invoice';
import { getInvoicePaymentMethodLabel } from '@/app/lib/invoicePaymentMethod';
import { getInvoiceItemNames, getInvoiceStatusTone } from '@/app/ui/tables/tableUtils';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanion, getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { getAvatarPalette } from '@/app/features/companions/pages/Companions/companionsDirectory';

const buildAppointmentSubtitle = (
  typeName: string | undefined,
  timeText: string,
  dateText?: string
): string => {
  const stamp = [dateText, timeText]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return [typeName, stamp]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');
};

/* Tablet (768–1279) prunes to <= 6 columns per "PIMS Responsive · Foundations",
   Adaptation rules: "tablet prunes to <=6 columns, meta folds into the sub-line".
   Services and the appointment date/time fold into the Parent / patient sub-line;
   Subtotal / Discount / Tax fold under Total. */
const joinMeta = (...parts: (string | undefined)[]): string => {
  const kept: string[] = [];
  for (const part of parts) {
    const text = part?.trim();
    if (text && text !== '-') kept.push(text);
  }
  return kept.join(' · ');
};

/* The status micro-badge is `white-space: nowrap` + `width: fit-content` +
   `overflow-hidden`, so an undersized column doesn't bleed the pill over the
   Payment cell — it silently clips the label instead ("AWAITING PAYMENT" ->
   "AWAITING PAYME"). The widest label measures 133.7px at 10px/700/0.08em
   Satoshi; 160px (- 22px td padding = 138px) left only ~4px of slack, which
   real-world font hinting/zoom/DPI variance ate into. 180px leaves a real
   margin (~23px). */
const STATUS_COLUMN_WIDTH = '180px';

/* Same failure one column over, and the only other fixed-width table cell whose
   own header does not fit: "Actions" needs 53.3px of Satoshi and the th carries
   31px of padding, so the shipped 64px (45px of content box) ellipsised the
   header itself to "Action..." on every desktop viewport, and the 56px tablet
   value cut it in half. This is the one table with `table-layout: fixed`, so
   unlike every other PIMS table it cannot grow a column to fit its label. 88px
   leaves ~4px of slack. */
const ACTIONS_COLUMN_WIDTH = '88px';

const renderInvoiceNumber = (item: Invoice) => (
  <div
    className="appointment-profile-title tabular-nums cell-strong"
    title={getInvoiceNumberLabel(item) || undefined}
  >
    {getInvoiceNumberLabel(item) || '-'}
  </div>
);

const renderServices = (item: Invoice) => {
  // A comma-joined line-item list in a 180px column wrapped to as many lines as
  // the invoice had items, so one busy row set the height of the whole page.
  const names = getInvoiceItemNames(item.items);
  return (
    <div className="appointment-profile-title cell-muted cell-truncate" title={names || undefined}>
      {names}
    </div>
  );
};

const renderStatus = (item: Invoice) => (
  <StatusPill tone={getInvoiceStatusTone(item?.status)} label={toTitle(item?.status)} />
);

const renderPayment = (item: Invoice) => (
  <div className="appointment-profile-title cell-muted">{getInvoicePaymentMethodLabel(item)}</div>
);

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InvoiceTableProps = {
  filteredList: Invoice[];
  setActiveInvoice?: (inventory: Invoice) => void;
  setViewInvoice?: (open: boolean) => void;
};

const InvoiceTable = ({ filteredList, setActiveInvoice, setViewInvoice }: InvoiceTableProps) => {
  const router = useRouter();
  const appointments = useAppointmentsForPrimaryOrg();
  const currency = useCurrencyForPrimaryOrg();

  const handleViewInvoice = (inventory: Invoice) => {
    setActiveInvoice?.(inventory);
    setViewInvoice?.(true);
  };

  const goToAppointmentFinance = (appointmentId?: string) => {
    const appointment = getAppointmentByIdFromList(appointments, appointmentId);
    if (!appointment?.id) {
      /* v8 ignore start -- unreachable: this only runs from the Date-cell button, which renders solely when the same lookup already resolved, and getAppointmentByIdFromList matches on a non-empty normalised id, so the appointment always has one */
      return;
      /* v8 ignore stop */
    }
    const params = new URLSearchParams({
      appointmentId: appointment.id,
      open: 'finance',
      subLabel: 'summary',
    });
    router.push(`/appointments?${params.toString()}`);
  };

  const getCompanionName = useMemo(
    () => (appointmentId: string | undefined) =>
      getCompanionNameFromAppointments(appointments, appointmentId),
    [appointments]
  );

  const getParentName = useMemo(
    () => (appointmentId: string | undefined) =>
      getParentNameFromAppointments(appointments, appointmentId),
    [appointments]
  );

  const renderParent = (item: Invoice, foldMeta: boolean) => {
    const companionName = getCompanionName(item.appointmentId);
    const parentName = getParentName(item.appointmentId);
    let ownerAndCompanion = '-';
    if (parentName !== '-' && companionName !== '-') {
      ownerAndCompanion = `${parentName} / ${companionName}`;
    } else if (parentName === '-') {
      if (companionName !== '-') {
        ownerAndCompanion = companionName;
      }
    } else {
      ownerAndCompanion = parentName;
    }
    const appointment = getAppointmentByIdFromList(appointments, item.appointmentId);
    const companion = appointment ? getAppointmentCompanion(appointment) : undefined;
    const avatarSrc = getSafeImageUrl(
      getAppointmentCompanionPhotoUrl(companion),
      (companion?.species as ImageType) ?? 'other'
    );
    // The Services column already carries the appointment type, and the Date
    // column carries the date, but neither shows the time — so the desktop
    // sub-line keeps just the time (not the type, which really is duplicated).
    // On tablet, Services/Date are dropped entirely, so their content folds
    // back in here alongside the time.
    const foldedDate =
      foldMeta && appointment ? formatDateLabel(appointment.appointmentDate) : undefined;
    const foldedTypeName = foldMeta ? appointment?.appointmentType?.name : undefined;
    const appointmentSubtitle = appointment
      ? buildAppointmentSubtitle(
          foldedTypeName,
          formatTimeLabel(appointment.startTime ?? appointment.appointmentDate),
          foldedDate
        )
      : '';
    // Tablet drops the Services and Date columns, so their content folds here.
    const subtitle = foldMeta
      ? joinMeta(appointmentSubtitle, getInvoiceItemNames(item.items))
      : appointmentSubtitle;
    // Design rings the row avatar in the companion's species tint, not a flat
    // neutral disc — the tint is what shows through an initials fallback.
    const avatarPalette = getAvatarPalette(companion?.id || companionName);
    return (
      <div className="appointment-profile flex items-center gap-2.5">
        <div
          className="flex size-[30px] shrink-0 overflow-hidden rounded-full"
          style={{ background: avatarPalette.bg }}
        >
          <Image
            src={avatarSrc}
            alt=""
            width={30}
            height={30}
            className="size-[30px] rounded-full object-cover"
          />
        </div>
        <div className="appointment-profile-two min-w-0">
          <div
            className="appointment-profile-title cell-name cell-truncate"
            title={ownerAndCompanion}
          >
            {ownerAndCompanion}
          </div>
          {subtitle && (
            <div className="appointment-profile-sub truncate" title={subtitle}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* Design draws the date as one muted line with a small inline open-outline —
     no bordered box, no second time line (the time already rides the identity
     sub-line one column to the left). */
  const renderDate = (item: Invoice) => {
    const appointment = getAppointmentByIdFromList(appointments, item.appointmentId);
    const companionName = getCompanionName(item.appointmentId);
    return (
      <div className="appointment-profile-two">
        {appointment && (
          <button
            type="button"
            onClick={() => goToAppointmentFinance(item.appointmentId)}
            aria-label={`Open finance details for ${companionName}`}
            className="flex items-center gap-[5px] text-left text-[12px] underline-offset-2 hover:underline"
            style={{ color: 'var(--ink-muted)' }}
            title="Open appointment finance"
          >
            {formatDateLabel(appointment.appointmentDate)}
            <IoOpenOutline size={12} className="shrink-0" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  const renderSubtotal = (item: Invoice) => (
    <div className="appointment-profile-title cell-figure">
      {formatMoney(item.subtotal, currency)}
    </div>
  );

  const renderTax = (item: Invoice) => (
    <div className="appointment-profile-title cell-figure">
      {formatMoney(item.taxTotal ?? 0, currency)}
    </div>
  );

  const renderTotal = (item: Invoice, foldBreakdown: boolean) => {
    // Tablet drops Subtotal / Discount / Tax, so the derivation folds under Total.
    const breakdown = foldBreakdown
      ? joinMeta(
          `Sub ${formatMoney(item.subtotal, currency)}`,
          `Disc ${formatMoney(item.discountTotal ?? 0, currency)}`,
          `Tax ${formatMoney(item.taxTotal ?? 0, currency)}`
        )
      : '';
    return (
      <div className="appointment-profile-two min-w-0">
        <div className="appointment-profile-title cell-figure-strong">
          {formatMoney(item.totalAmount ?? 0, currency)}
        </div>
        {breakdown && (
          <div className="appointment-profile-sub truncate" title={breakdown}>
            {breakdown}
          </div>
        )}
      </div>
    );
  };

  const renderActions = (item: Invoice) => (
    <div className="action-btn-col">
      <button
        type="button"
        onClick={() => handleViewInvoice(item)}
        aria-label={`View invoice ${item.id ?? ''}`.trim()}
        className="grid-row-action size-[30px] rounded-full! border flex items-center justify-center cursor-pointer transition-colors hover:bg-card-hover"
      >
        <IoEye size={14} style={{ color: 'var(--ink-soft)' }} />
      </button>
    </div>
  );

  /* Desktop (>= 1280): the design's ledger — Subtotal, Tax and Total each get a
     column. Discount is deliberately NOT one of them: it only appears in the
     invoice detail Summary, where the line-level breakdown lives. */
  const columns: Column<Invoice>[] = [
    { label: 'Invoice', key: 'invoice-number', width: '96px', render: renderInvoiceNumber },
    {
      label: 'Parent / patient',
      key: 'appointment-id',
      width: '200px',
      render: (item: Invoice) => renderParent(item, false),
    },
    { label: 'Services', key: 'service', width: '180px', render: renderServices },
    { label: 'Date', key: 'date', width: '150px', render: renderDate },
    { label: 'Subtotal', key: 'sub-total', width: '90px', render: renderSubtotal },
    { label: 'Tax', key: 'tax', width: '70px', render: renderTax },
    {
      label: 'Total',
      key: 'total',
      width: '80px',
      render: (item: Invoice) => renderTotal(item, false),
    },
    { label: 'Status', key: 'status', width: STATUS_COLUMN_WIDTH, render: renderStatus },
    { label: 'Payment', key: 'payment', width: '110px', render: renderPayment },
    { label: 'Actions', key: 'actions', width: ACTIONS_COLUMN_WIDTH, render: renderActions },
  ];

  /* Tablet (768–1279): 6 columns — the ones you need to chase money.
     Invoice (the reference you quote), Parent / patient (who owes, fluid so it
     absorbs the slack), Total (the amount at stake), Status (paid or not — the
     point of the page), Payment (how it settles, which decides your next move),
     Actions. Services + Date fold into the identity sub-line; Subtotal /
     Discount / Tax fold under Total. */
  const tabletColumns: Column<Invoice>[] = [
    { label: 'Invoice', key: 'invoice-number', width: '84px', render: renderInvoiceNumber },
    {
      label: 'Parent / patient',
      key: 'appointment-id',
      render: (item: Invoice) => renderParent(item, true),
    },
    {
      label: 'Total',
      key: 'total',
      width: '104px',
      render: (item: Invoice) => renderTotal(item, true),
    },
    { label: 'Status', key: 'status', width: STATUS_COLUMN_WIDTH, render: renderStatus },
    { label: 'Payment', key: 'payment', width: '108px', render: renderPayment },
    { label: 'Actions', key: 'actions', width: ACTIONS_COLUMN_WIDTH, render: renderActions },
  ];

  return (
    <div className="table-wrapper invoice-scroll-x h-full min-h-0 overflow-hidden">
      {/* Finance deliberately does NOT use the shared `.table-list` / `.card-list`
          classes: DataTable.css hides `.table-list` at <=1280 and forces
          `.card-list` on, which would skip the design's tablet table entirely.
          Visibility here is pure Tailwind so the three bands can't disagree. */}
      <div className="hidden xl:flex h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={10}
          tableClassName="invoice-table-fixed"
          caption="Invoices with appointment details, totals, statuses, payment methods, and actions"
        />
      </div>
      <div className="hidden md:flex xl:hidden h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <GenericTable
          data={filteredList}
          columns={tabletColumns}
          bordered={false}
          pagination
          pageSize={10}
          tableClassName="invoice-compact-fixed table-fixed min-w-[540px]"
          caption="Invoices with parent and patient, totals, statuses, payment methods, and actions"
        />
      </div>
      <div className="flex md:hidden gap-4 sm:gap-6 flex-wrap content-start">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <output
                className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary"
                aria-live="polite"
              >
                No invoices match the current filters.
              </output>
            );
          }
          return filteredList.map((item, i) => (
            <InvoiceCard
              key={item.id || 'invoice-key' + i}
              invoice={item}
              handleViewInvoice={handleViewInvoice}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default InvoiceTable;
