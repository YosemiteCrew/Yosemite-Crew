import React from 'react';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import CompanionAvatar from '@/app/ui/avatars/CompanionAvatar';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { IoDownloadOutline, IoOpenOutline } from 'react-icons/io5';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import { getInvoiceNumberLabel } from '@/app/lib/invoice';
import { formatDateLabel } from '@/app/lib/forms';
import { getSafeImageUrl, getSafePdfPreviewUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanion, getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';

type InvoiceDetailHeaderProps = {
  titleId: string;
  invoice: Invoice;
  appointment?: Appointment;
  statusLabel: string;
  statusStyle?: React.CSSProperties;
  statusTone?: StatusTone;
  onClose: () => void;
  onOpenAppointment?: () => void;
};

const buildSubtitle = (appointment?: Appointment): string => {
  if (!appointment) return '';
  const companion = getAppointmentCompanion(appointment);
  const identity = formatCompanionNameWithOwnerLastName(companion.name, companion.parent);
  const service = appointment.appointmentType?.name;
  const dateText = formatDateLabel(appointment.appointmentDate);
  return [identity, service, dateText]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');
};

const InvoiceDetailHeader = ({
  titleId,
  invoice,
  appointment,
  statusLabel,
  statusStyle,
  statusTone,
  onClose,
  onOpenAppointment,
}: InvoiceDetailHeaderProps) => {
  const numberLabel = getInvoiceNumberLabel(invoice) || 'Invoice';
  const subtitle = buildSubtitle(appointment);
  const companion = appointment ? getAppointmentCompanion(appointment) : undefined;
  const avatarSrc = getSafeImageUrl(
    getAppointmentCompanionPhotoUrl(companion),
    (companion?.species as ImageType) ?? 'other'
  );
  // React does not sanitize href protocols, so an invoice record carrying a
  // `javascript:` or `data:` URL would run on click. The same helper the PDF
  // preview overlay uses accepts only https (and localhost over http in dev)
  // and returns '' for anything else.
  const pdfUrl = getSafePdfPreviewUrl(invoice.pdfUrl);
  const isPhone = useIsPhone();

  const statusPill = statusLabel ? (
    <StatusPill className="shrink-0" label={statusLabel} tone={statusTone} style={statusStyle} />
  ) : null;

  const pdfLink = pdfUrl ? (
    <a
      href={pdfUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 h-9 px-[15px] rounded-full border border-[var(--divider)] text-[12.5px] font-semibold text-[var(--ink-body)] hover:bg-[var(--inset)] transition-colors"
      aria-label={`Download invoice ${numberLabel} PDF`}
    >
      <IoDownloadOutline size={14} aria-hidden="true" />
      PDF
    </a>
  ) : null;

  const openAppointmentButton =
    appointment && onOpenAppointment ? (
      <button
        type="button"
        onClick={onOpenAppointment}
        className="flex items-center gap-1.5 h-9 px-[15px] rounded-full border border-[var(--divider)] text-[12.5px] font-semibold text-[var(--ink-body)] hover:bg-[var(--inset)] transition-colors"
      >
        <IoOpenOutline size={14} aria-hidden="true" />
        Open appointment
      </button>
    ) : null;

  /* At 390px the header row is 342px wide and the actions ask for more than it
     has - 334px with a PDF link and an Open appointment button beside the status
     pill. `ModalHeader` gives the title column `min-w-0` and the actions
     `shrink-0`, so the deficit is taken entirely out of the invoice number,
     which renders at 0px: present, 26px tall, and showing nothing.

     Measured at 390x844, per story:

       actions   row   invoice number gets / needs
         257     342          25 / 139     status pill 134 + PDF 75 + close 32
         251     342          31 / 132     status pill  48 + open 155 + close 32
         334     342           0 / 132     all four

     So this is a budget, not a ranking: giving the title priority would only
     move which control is destroyed. On a phone the row keeps the identity and
     the close button, the status moves under the title, and the two navigation
     controls take a row of their own where they stay reachable and legible. */
  const phoneActionRow =
    isPhone && (pdfLink || openAppointmentButton) ? (
      <div className="flex flex-wrap items-center gap-2">
        {pdfLink}
        {openAppointmentButton}
      </div>
    ) : null;

  const header = (
    <ModalHeader
      titleId={titleId}
      title={numberLabel}
      meta={
        isPhone && statusPill ? (
          <span className="flex flex-wrap items-center gap-2">
            {statusPill}
            {subtitle}
          </span>
        ) : (
          subtitle || undefined
        )
      }
      onClose={onClose}
      icon={
        <span className="flex size-10 shrink-0 overflow-hidden rounded-full bg-card-hover">
          <AvatarImage
            src={avatarSrc}
            alt=""
            size={40}
            className="size-10 rounded-full object-cover"
            fallback={
              <CompanionAvatar
                name={companion?.name}
                seed={companion?.id}
                size={40}
                textClassName="text-[18px]"
              />
            }
          />
        </span>
      }
      actions={
        isPhone ? undefined : (
          <>
            {statusPill}
            {pdfLink}
            {openAppointmentButton}
          </>
        )
      }
    />
  );

  if (!phoneActionRow) return header;

  return (
    <div className="flex flex-col gap-3">
      {header}
      {phoneActionRow}
    </div>
  );
};

export default InvoiceDetailHeader;
