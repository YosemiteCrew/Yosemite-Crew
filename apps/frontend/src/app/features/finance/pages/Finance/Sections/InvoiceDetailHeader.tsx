import React from 'react';
import Image from 'next/image';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { IoDownloadOutline, IoOpenOutline } from 'react-icons/io5';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { getInvoiceNumberLabel } from '@/app/lib/invoice';
import { formatDateLabel } from '@/app/lib/forms';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanion, getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';

type InvoiceDetailHeaderProps = {
  titleId: string;
  invoice: Invoice;
  appointment?: Appointment;
  statusLabel: string;
  statusStyle: React.CSSProperties;
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
  const pdfUrl = invoice.pdfUrl;

  return (
    <ModalHeader
      titleId={titleId}
      title={numberLabel}
      meta={subtitle || undefined}
      onClose={onClose}
      icon={
        <span className="flex size-10 shrink-0 overflow-hidden rounded-full bg-card-hover">
          <Image
            src={avatarSrc}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-full object-cover"
          />
        </span>
      }
      actions={
        <>
          {statusLabel && (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-[0.08em] border shrink-0"
              style={statusStyle}
            >
              {statusLabel}
            </span>
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
