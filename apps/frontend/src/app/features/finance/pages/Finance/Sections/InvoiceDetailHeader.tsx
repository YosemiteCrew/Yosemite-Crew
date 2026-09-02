import React from 'react';
import AvatarImage from '@/app/ui/avatars/AvatarImage';
import CompanionAvatar from '@/app/ui/avatars/CompanionAvatar';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { IoDownloadOutline, IoOpenOutline } from 'react-icons/io5';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
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

  return (
    <ModalHeader
      titleId={titleId}
      title={numberLabel}
      meta={subtitle || undefined}
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
        <>
          {statusLabel && (
            <StatusPill
              className="shrink-0"
              label={statusLabel}
              tone={statusTone}
              style={statusStyle}
            />
          )}
          {pdfUrl && (
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
          )}
          {appointment && onOpenAppointment && (
            <button
              type="button"
              onClick={onOpenAppointment}
              className="flex items-center gap-1.5 h-9 px-[15px] rounded-full border border-[var(--divider)] text-[12.5px] font-semibold text-[var(--ink-body)] hover:bg-[var(--inset)] transition-colors"
            >
              <IoOpenOutline size={14} aria-hidden="true" />
              Open appointment
            </button>
          )}
        </>
      }
    />
  );
};

export default InvoiceDetailHeader;
