import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { IoEye, IoOpenOutline } from 'react-icons/io5';

import type { Invoice } from '@yosemite-crew/types';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { useCompanionStore } from '@/app/stores/companionStore';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { formatMoneyPrecise, recordCurrency } from '@/app/lib/money';
import {
  getAppointmentByIdFromList,
  getCompanionNameFromAppointments,
  getParentNameFromAppointments,
} from '@/app/lib/invoice';
import { getInvoiceItemNames } from '@/app/ui/tables/tableUtils';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanion, getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import {
  getAvatarPalette,
  getMonogram,
} from '@/app/features/companions/pages/Companions/companionsDirectory';

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

const joinMeta = (...parts: (string | undefined)[]): string => {
  const kept: string[] = [];
  for (const part of parts) {
    const text = part?.trim();
    if (text && text !== '-') kept.push(text);
  }
  return kept.join(' · ');
};

const joinOwnerAndCompanion = (parentName: string, companionName: string): string => {
  const parts = [parentName, companionName].filter((part) => part !== '-');
  return parts.length > 0 ? parts.join(' / ') : '-';
};

type UseInvoiceRowRenderersOptions = {
  setActiveInvoice?: (invoice: Invoice) => void;
  setViewInvoice?: (open: boolean) => void;
};

/**
 * The invoice ledger's cell renderers, and the lookups they close over.
 *
 * InvoiceTable was ~305 lines, about 200 of them these renderers, which is what
 * React Doctor's `no-giant-component` was pointing at. They move as a block and
 * the three responsive bands stay exactly where they were, so the DOM is
 * unchanged and the stories that assert per-band visibility and column counts
 * still mean what they meant.
 */
export const useInvoiceRowRenderers = ({
  setActiveInvoice,
  setViewInvoice,
}: UseInvoiceRowRenderersOptions) => {
  const router = useRouter();
  const appointments = useAppointmentsForPrimaryOrg();
  const currency = useCurrencyForPrimaryOrg();
  const companionsById = useCompanionStore((state) => state.companionsById);

  const handleViewInvoice = (inventory: Invoice) => {
    setActiveInvoice?.(inventory);
    setViewInvoice?.(true);
  };

  const goToAppointmentFinance = (appointmentId?: string) => {
    const appointment = getAppointmentByIdFromList(appointments, appointmentId);
    if (!appointment?.id) {
      /* v8 ignore start -- unreachable: this only runs from the Appointment-cell button, which renders solely when the same lookup already resolved, and getAppointmentByIdFromList matches on a non-empty normalised id, so the appointment always has one */
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
    // An invoice converted from an estimate carries patientId and no
    // appointmentId (deliberately - the estimate service has no route to one),
    // so the appointment lookup yields nothing and the row would read "-" for a
    // patient that is perfectly well known. Fall back to the companion store.
    const companionFromPatient = item.patientId ? companionsById[item.patientId] : undefined;
    const companionFromAppointment = getCompanionName(item.appointmentId);
    const companionName =
      companionFromAppointment === '-' && companionFromPatient?.name
        ? companionFromPatient.name
        : companionFromAppointment;
    const parentName = getParentName(item.appointmentId);
    const ownerAndCompanion = joinOwnerAndCompanion(parentName, companionName);
    const appointment = getAppointmentByIdFromList(appointments, item.appointmentId);
    const companion = appointment ? getAppointmentCompanion(appointment) : undefined;
    const avatarSrc = getSafeImageUrl(
      getAppointmentCompanionPhotoUrl(companion),
      (companion?.species as ImageType) ?? 'other'
    );
    // The Services column already carries the appointment type, and the
    // Appointment column carries its date, but neither shows the time — so the
    // desktop sub-line keeps just the time (not the type, which really is
    // duplicated). On tablet, Services/Appointment are dropped entirely, so
    // their content folds back in here alongside the time.
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
    // Tablet drops the Services and Appointment columns, so their content folds here.
    const subtitle = foldMeta
      ? joinMeta(appointmentSubtitle, getInvoiceItemNames(item.items))
      : appointmentSubtitle;
    // Design rings the row avatar in the companion's species tint, not a flat
    // neutral disc — the tint is what shows through the initials fallback that
    // takes over when the photo URL no longer resolves.
    const avatarPalette = getAvatarPalette(companion?.id || companionName);
    return (
      <div className="appointment-profile flex items-center gap-2.5">
        <div
          className="flex size-[30px] shrink-0 overflow-hidden rounded-full"
          style={{ background: avatarPalette.bg }}
        >
          <AvatarImage
            src={avatarSrc}
            alt=""
            size={30}
            className="size-[30px] rounded-full object-cover"
            fallback={
              <span
                aria-hidden="true"
                className="flex size-full items-center justify-center font-newsreader text-[13px]"
                style={{ color: avatarPalette.ink }}
              >
                {getMonogram(companionName === '-' ? null : companionName)}
              </span>
            }
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
     sub-line one column to the left).

     This column is the APPOINTMENT date, not the invoice's own date, and it was
     headed "Date" — the same label the card and phone renderings put over
     `invoice.createdAt`. An invoice raised three days after the visit therefore
     read "Sep 3" on desktop and "Sep 6" on a phone under one label. The header
     is "Appointment" now; the card says "Invoice date". An invoice converted
     from an estimate has no appointment at all, and this cell used to render
     completely blank in that case — it shows the table's "-" now. */
  const renderDate = (item: Invoice) => {
    const appointment = getAppointmentByIdFromList(appointments, item.appointmentId);
    const companionName = getCompanionName(item.appointmentId);
    if (!appointment) {
      return <div className="appointment-profile-title cell-muted">-</div>;
    }
    return (
      <div className="appointment-profile-two">
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
      </div>
    );
  };

  const renderSubtotal = (item: Invoice) => (
    <div className="appointment-profile-title cell-figure">
      {formatMoneyPrecise(item.subtotal, recordCurrency(item, currency))}
    </div>
  );

  const renderTax = (item: Invoice) => (
    <div className="appointment-profile-title cell-figure">
      {formatMoneyPrecise(item.taxTotal ?? 0, recordCurrency(item, currency))}
    </div>
  );

  const renderTotal = (item: Invoice, foldBreakdown: boolean) => {
    // One resolution for the whole row: every figure here is the same invoice's.
    const money = recordCurrency(item, currency);
    // Tablet drops Subtotal / Discount / Tax, so the derivation folds under Total.
    const breakdown = foldBreakdown
      ? joinMeta(
          `Sub ${formatMoneyPrecise(item.subtotal, money)}`,
          `Disc ${formatMoneyPrecise(item.discountTotal ?? 0, money)}`,
          `Tax ${formatMoneyPrecise(item.taxTotal ?? 0, money)}`
        )
      : '';
    return (
      <div className="appointment-profile-two min-w-0">
        <div className="appointment-profile-title cell-figure-strong">
          {formatMoneyPrecise(item.totalAmount ?? 0, money)}
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

  return {
    handleViewInvoice,
    renderParent,
    renderDate,
    renderSubtotal,
    renderTax,
    renderTotal,
    renderActions,
  };
};
