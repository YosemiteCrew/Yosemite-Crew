import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import {
  allowReschedule,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  getAllowedAppointmentStatusTransitions,
  getAppointmentCompanionPhotoUrl,
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
  toStatusLabel,
} from '@/app/lib/appointments';
import { getStatusStyle } from '@/app/config/statusConfig';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';
import { getAppointmentPaymentDisplay } from '@/app/lib/paymentStatus';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import {
  acceptAppointment,
  changeAppointmentStatus,
  rejectAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { useOrgStore } from '@/app/stores/orgStore';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import {
  IoEyeOutline,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoCardOutline,
  IoFlaskOutline,
} from 'react-icons/io5';
import { MdMeetingRoom } from 'react-icons/md';
import { RiHistoryLine } from 'react-icons/ri';
import { FaCaretDown, FaCheckCircle } from 'react-icons/fa';
import { IoIosCloseCircle } from 'react-icons/io';
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';

type AppointmentPopoverProps = {
  appointment: Appointment;
  invoicesByAppointmentId: Record<string, Invoice>;
  canEditAppointments: boolean;
  popoverDialogRef: React.RefObject<HTMLDialogElement | null>;
  popoverStyle: React.CSSProperties;
  handleViewAppointment: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  handleChangeRoomAppointment?: (appt: Appointment) => void;
  onClose: () => void;
  registerAnchorEl: (el: HTMLElement | null) => () => void;
};

const formatTimeRange = (event: Appointment) => {
  const start = formatDateInPreferredTimeZone(event.startTime, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const end = formatDateInPreferredTimeZone(event.endTime, { hour: 'numeric', minute: '2-digit' });
  return `${start} - ${end}`;
};

const getCompanionDisplayName = (appointment: Appointment) =>
  formatCompanionNameWithOwnerLastName(appointment.companion?.name, appointment.companion?.parent);

const AppointmentPopover: React.FC<AppointmentPopoverProps> = ({
  appointment,
  invoicesByAppointmentId,
  canEditAppointments,
  popoverDialogRef,
  popoverStyle,
  handleViewAppointment,
  handleRescheduleAppointment,
  handleChangeRoomAppointment,
  onClose,
  registerAnchorEl,
}) => {
  const router = useRouter();
  const orgsById = useOrgStore((s) => s.orgsById);
  const payment = getAppointmentPaymentDisplay(appointment, invoicesByAppointmentId);
  const companionDisplayName = getCompanionDisplayName(appointment);
  const orgType =
    (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';
  const clinicalNotesLabel = getClinicalNotesLabel(orgType);
  const clinicalNotesIntent = getClinicalNotesIntent(orgType);

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const statusPanelRef = useRef<HTMLDivElement>(null);

  const statusStyle = getStatusStyle(appointment.status);
  const allowedTransitions = getAllowedAppointmentStatusTransitions(appointment.status);
  const canChangeStatus =
    canEditAppointments &&
    !isRequestedLikeStatus(appointment.status) &&
    canShowStatusChangeAction(appointment.status) &&
    allowedTransitions.length > 0;

  const positionDropdown = () => {
    if (!statusTriggerRef.current) return;
    const rect = statusTriggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: 'max-content',
      zIndex: 10000,
    });
  };

  useLayoutEffect(() => {
    if (statusDropdownOpen) positionDropdown();
  }, [statusDropdownOpen]); // positionDropdown reads refs, no deps needed

  useEffect(() => {
    if (!statusDropdownOpen) return;
    return registerAnchorEl(statusPanelRef.current);
  }, [statusDropdownOpen, registerAnchorEl]);

  useEffect(() => {
    if (!statusDropdownOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        statusTriggerRef.current?.contains(e.target as Node) ||
        statusPanelRef.current?.contains(e.target as Node)
      )
        return;
      setStatusDropdownOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [statusDropdownOpen]);

  const handleStatusChange = async (nextStatus: AppointmentStatus) => {
    try {
      setSavingStatus(true);
      setStatusError(null);
      await changeAppointmentStatus(appointment, nextStatus);
      setStatusDropdownOpen(false);
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Failed to update status.';
      setStatusError(String(msg));
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <dialog
      ref={popoverDialogRef}
      open
      className="fixed z-[1000] w-[380px] rounded-2xl border border-card-border bg-white p-3 shadow-[0_18px_45px_rgba(0,0,0,0.14)]"
      style={popoverStyle}
      aria-label="Appointment quick actions"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <Image
            src={getSafeImageUrl(
              getAppointmentCompanionPhotoUrl(appointment.companion),
              appointment.companion.species.toLowerCase() as ImageType
            )}
            height={34}
            width={34}
            className="rounded-full border border-card-border bg-white object-cover"
            style={{ width: 34, height: 34 }}
            alt=""
          />
          <div className="min-w-0">
            <button
              type="button"
              className="text-body-3-emphasis text-text-primary truncate cursor-pointer hover:underline underline-offset-2 text-left"
              onClick={() => {
                router.push(
                  buildAppointmentCompanionHistoryHref(
                    appointment.id,
                    appointment.companion?.id,
                    '/appointments'
                  )
                );
                onClose();
              }}
              title="Open appointment overview"
            >
              {companionDisplayName}
            </button>
            <div className="text-caption-1 text-text-secondary truncate">
              {appointment.companion.breed || '-'} / {appointment.companion.species || '-'}
            </div>
          </div>
        </div>

        {/* Status pill — acts as dropdown trigger if status can be changed */}
        <div className="relative flex-shrink-0">
          {canChangeStatus ? (
            <button
              ref={statusTriggerRef}
              type="button"
              data-popover-panel="true"
              disabled={savingStatus}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setStatusDropdownOpen((v) => !v)}
              className="flex items-center gap-1 text-caption-2 px-2 py-1 rounded-2xl! whitespace-nowrap"
              style={{
                backgroundColor: statusStyle.backgroundColor,
                color: statusStyle.color,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: statusStyle.borderColor,
                opacity: savingStatus ? 0.6 : 1,
              }}
            >
              {savingStatus ? 'Saving…' : toStatusLabel(appointment.status)}
              <FaCaretDown
                size={10}
                className={`shrink-0 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
          ) : (
            <span
              className="text-caption-2 px-2 py-1 rounded-2xl! whitespace-nowrap"
              style={{
                backgroundColor: statusStyle.backgroundColor,
                color: statusStyle.color,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: statusStyle.borderColor,
              }}
            >
              {toStatusLabel(appointment.status)}
            </span>
          )}

          {statusError && (
            <div className="absolute right-0 top-full mt-1 text-[10px] text-text-error whitespace-nowrap bg-white border border-card-border rounded-lg px-2 py-1 shadow-sm z-10">
              {statusError}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-card-border bg-card-hover px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="text-caption-1 text-text-secondary">Time</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {formatTimeRange(appointment)}
        </div>
        <div className="text-caption-1 text-text-secondary">Parent</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {getOwnerFirstName(appointment.companion.parent) || '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">Lead</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {appointment.lead?.name || '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">Speciality</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {appointment.appointmentType?.speciality?.name || '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">Service</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {appointment.appointmentType?.name || '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">Room</div>
        <div className="text-caption-1 text-text-primary text-right truncate">
          {appointment.room?.name || '-'}
        </div>
        <div className="text-caption-1 text-text-secondary">Payment</div>
        <div
          className="text-caption-1 text-right truncate font-medium"
          style={{ color: payment?.textColor || '#302F2E' }}
        >
          {payment?.label || '-'}
        </div>
      </div>

      <div className="mt-2 text-caption-1 text-text-secondary">Reason</div>
      <div className="text-caption-1 text-text-primary min-h-6 line-clamp-2">
        {appointment.concern || '-'}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-card-border pt-2 flex-wrap">
        {canEditAppointments && isRequestedLikeStatus(appointment.status) && (
          <>
            <GlassTooltip content="Accept request" side="top">
              <button
                type="button"
                title="Accept request"
                className="h-9 w-9 rounded-full! flex items-center justify-center hover:bg-[#E6F4EF] border border-card-border"
                onClick={async () => {
                  await acceptAppointment(appointment);
                  onClose();
                }}
              >
                <FaCheckCircle size={18} color="#54B492" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Decline request" side="top">
              <button
                type="button"
                title="Decline request"
                className="h-9 w-9 rounded-full! flex items-center justify-center hover:bg-[#FDEBEA] border border-card-border"
                onClick={async () => {
                  await rejectAppointment(appointment);
                  onClose();
                }}
              >
                <IoIosCloseCircle size={20} color="#EA3729" />
              </button>
            </GlassTooltip>
          </>
        )}
        {!isRequestedLikeStatus(appointment.status) && (
          <>
            <GlassTooltip content="View appointment" side="top">
              <button
                type="button"
                title="View appointment"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment);
                  onClose();
                }}
              >
                <IoEyeOutline size={18} />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Overview" side="top">
              <button
                type="button"
                title="Appointment overview"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  router.push(
                    buildAppointmentCompanionHistoryHref(
                      appointment.id,
                      appointment.companion?.id,
                      '/appointments'
                    )
                  );
                  onClose();
                }}
              >
                <RiHistoryLine size={17} />
              </button>
            </GlassTooltip>
            {canEditAppointments && allowReschedule(appointment.status) && (
              <GlassTooltip content="Reschedule" side="top">
                <button
                  type="button"
                  title="Reschedule"
                  className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                  onClick={() => {
                    handleRescheduleAppointment(appointment);
                    onClose();
                  }}
                >
                  <IoCalendarOutline size={18} />
                </button>
              </GlassTooltip>
            )}
            {canEditAppointments && canAssignAppointmentRoom(appointment.status) && (
              <GlassTooltip content="Assign room" side="top">
                <button
                  type="button"
                  title="Assign room"
                  className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                  onClick={() => {
                    handleChangeRoomAppointment?.(appointment);
                    onClose();
                  }}
                >
                  <MdMeetingRoom size={18} />
                </button>
              </GlassTooltip>
            )}
            <GlassTooltip content={clinicalNotesLabel} side="top">
              <button
                type="button"
                title={clinicalNotesLabel}
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment, clinicalNotesIntent);
                  onClose();
                }}
              >
                <IoDocumentTextOutline size={18} />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Finance summary" side="top">
              <button
                type="button"
                title="Finance summary"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment, { label: 'finance', subLabel: 'summary' });
                  onClose();
                }}
              >
                <IoCardOutline size={18} />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Lab tests" side="top">
              <button
                type="button"
                title="Lab tests"
                className="h-9 w-9 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment, { label: 'labs', subLabel: 'idexx-labs' });
                  onClose();
                }}
              >
                <IoFlaskOutline size={18} />
              </button>
            </GlassTooltip>
          </>
        )}
      </div>

      {/* Status dropdown portal — hover events handled via registerAnchorEl */}
      {statusDropdownOpen &&
        createPortal(
          <div
            ref={statusPanelRef}
            data-popover-panel="true"
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-2xl! bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden whitespace-nowrap"
            style={{
              ...dropdownStyle,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--color-card-border)',
            }}
          >
            {allowedTransitions.map((nextStatus) => {
              const s = getStatusStyle(nextStatus);
              return (
                <button
                  key={nextStatus}
                  type="button"
                  disabled={savingStatus}
                  onClick={() => void handleStatusChange(nextStatus)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-caption-2 text-left transition-colors hover:bg-card-hover rounded-none!"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: s.borderColor,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: s.borderColor,
                    }}
                  />
                  <span style={{ color: s.color }}>{toStatusLabel(nextStatus)}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </dialog>
  );
};

export default AppointmentPopover;
