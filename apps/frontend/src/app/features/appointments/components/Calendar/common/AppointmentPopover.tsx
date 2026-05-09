import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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
import { normalizeAppointmentId } from '@/app/lib/invoice';
import { formatMoney } from '@/app/lib/money';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
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
  IoWarning,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoCardOutline,
  IoFlaskOutline,
  IoArrowForward,
  IoPerson,
  IoTimeOutline,
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
  popoverId: string;
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

const formatAppointmentDate = (event: Appointment) =>
  formatDateInPreferredTimeZone(event.appointmentDate, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const getPaymentTitle = (paymentState?: string) => {
  if (paymentState === 'PAID' || paymentState === 'PAID_CASH') return 'Paid';
  if (paymentState === 'UNPAID' || paymentState === 'PAYMENT_AT_CLINIC') return 'Amount Due';
  return 'Estimate';
};

const getInvoiceForAppointment = (
  appointmentId: string | undefined,
  invoicesByAppointmentId: Record<string, Invoice>
) => {
  const normalizedId = normalizeAppointmentId(appointmentId);
  return normalizedId ? invoicesByAppointmentId[normalizedId] : undefined;
};

const getPaymentValue = (paymentLabel: string | undefined, invoice: Invoice | undefined) => {
  if (!invoice) return paymentLabel || '-';
  return formatMoney(invoice.totalAmount, invoice.currency);
};

const PopoverDetail = ({
  label,
  value,
  emphasized = false,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  emphasized?: boolean;
  icon?: React.ReactNode;
}) => (
  <div className="min-w-0">
    <div className="font-satoshi text-[12px] font-medium leading-[120%] text-text-extra">
      {label}
    </div>
    <div
      className={`mt-1 min-w-0 font-satoshi leading-[120%] text-text-primary ${
        emphasized ? 'text-[16px] font-bold' : 'text-[14px] font-normal'
      }`}
    >
      <span className="relative block min-w-0 overflow-visible">
        {icon ? (
          <span className="pointer-events-none absolute -left-5 top-1/2 -translate-y-1/2 text-text-extra">
            {icon}
          </span>
        ) : null}
        <span className="block truncate">{value}</span>
      </span>
    </div>
  </div>
);

const StaffInput = ({ label, value }: { label: string; value: string }) => (
  <div className="relative min-w-0">
    <span className="pointer-events-none absolute left-5 top-0 z-10 flex -translate-y-1/2 items-center gap-1 bg-white px-1 font-satoshi text-sm leading-none text-input-text-placeholder">
      <IoPerson size={12} className="text-text-extra" aria-hidden="true" />
      {label}
    </span>
    <FormInput
      intype="text"
      inname={`appointment-popover-${label.toLowerCase()}`}
      inlabel=""
      value={value || '-'}
      readonly
      tabIndex={-1}
      className="truncate px-4! text-[14px]!"
    />
  </div>
);

const AppointmentPopoverComponent: React.FC<AppointmentPopoverProps> = ({
  appointment,
  invoicesByAppointmentId,
  canEditAppointments,
  popoverId,
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
  const titleId = useId();
  const statusMenuId = useId();

  const statusStyle = getStatusStyle(appointment.status);
  const allowedTransitions = getAllowedAppointmentStatusTransitions(appointment.status);
  const appointmentInvoice = getInvoiceForAppointment(appointment.id, invoicesByAppointmentId);
  const paymentTitle = getPaymentTitle(payment?.state);
  const paymentValue = getPaymentValue(payment?.label, appointmentInvoice);
  const supportStaffValue = appointment.supportStaff?.map((staff) => staff.name).join(', ') || '-';
  const primaryActionLabel =
    appointment.status === 'UPCOMING' ? 'Start Appointment' : 'View Appointment';
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
      id={popoverId}
      ref={popoverDialogRef}
      open
      className="fixed z-[1000] w-[440px] rounded-2xl border border-card-border bg-white p-4 shadow-[0_18px_45px_rgba(0,0,0,0.14)]"
      style={popoverStyle}
      aria-labelledby={titleId}
      aria-modal="false"
      data-popover-panel="true"
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-card-border pb-2.5">
        <div className="min-w-0 flex items-center gap-3">
          <Image
            src={getSafeImageUrl(
              getAppointmentCompanionPhotoUrl(appointment.companion),
              appointment.companion.species.toLowerCase() as ImageType
            )}
            height={48}
            width={48}
            className="shrink-0 rounded-full border border-card-border bg-white object-cover"
            style={{ width: 48, height: 48 }}
            alt=""
          />
          <div className="min-w-0">
            <button
              type="button"
              id={titleId}
              className="block max-w-full truncate font-satoshi text-[20px] font-bold leading-[120%] tracking-[-0.025rem] text-text-primary cursor-pointer hover:underline underline-offset-2 text-left"
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
            <div className="mt-1 truncate font-satoshi text-[14px] font-normal leading-[120%] tracking-[-0.0175rem] text-text-tertiary">
              {appointment.companion.breed || '-'} / {appointment.companion.species || '-'}
            </div>
          </div>
        </div>

        {/* Status pill — acts as dropdown trigger if status can be changed */}
        <div className="relative flex-shrink-0 flex flex-col items-end gap-1.5">
          {canChangeStatus ? (
            <button
              ref={statusTriggerRef}
              type="button"
              data-popover-panel="true"
              disabled={savingStatus}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setStatusDropdownOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={statusDropdownOpen}
              aria-controls={statusMenuId}
              className="flex h-8 min-w-25 items-center justify-between gap-1.5 rounded-2xl! px-3 py-2 font-satoshi text-[14px] font-medium leading-[120%] tracking-[-0.0175rem] whitespace-nowrap shadow-[0_1px_10px_0_rgba(169,163,158,0.10)]"
              style={{
                backgroundColor: statusStyle.backgroundColor,
                color: statusStyle.color,
                fontFamily: 'var(--font-satoshi), sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                lineHeight: '120%',
                letterSpacing: '-0.28px',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: statusStyle.borderColor,
                opacity: savingStatus ? 0.6 : 1,
              }}
            >
              <span>{savingStatus ? 'Saving…' : toStatusLabel(appointment.status)}</span>
              <FaCaretDown
                size={10}
                className={`shrink-0 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
          ) : (
            <span
              className="flex h-8 min-w-25 items-center justify-center rounded-2xl! px-3 py-2 font-satoshi text-[14px] font-medium leading-[120%] tracking-[-0.0175rem] whitespace-nowrap shadow-[0_1px_10px_0_rgba(169,163,158,0.10)]"
              style={{
                backgroundColor: statusStyle.backgroundColor,
                color: statusStyle.color,
                fontFamily: 'var(--font-satoshi), sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                lineHeight: '120%',
                letterSpacing: '-0.28px',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: statusStyle.borderColor,
              }}
            >
              {toStatusLabel(appointment.status)}
            </span>
          )}

          {appointment.isEmergency && (
            <div
              className="flex h-5.5 items-center gap-1 rounded-lg px-2 whitespace-nowrap"
              style={{
                border: '1px solid var(--error-color)',
                background: 'var(--color-danger-100)',
                color: 'var(--error-color)',
                fontFamily: 'var(--font-satoshi)',
                fontSize: '11px',
                fontWeight: 500,
                lineHeight: '150%',
                letterSpacing: '-0.22px',
              }}
            >
              <IoWarning size={11} aria-hidden="true" />
              {'Emergency'}
            </div>
          )}

          {statusError && (
            <div
              role="alert"
              className="absolute right-0 top-full mt-1 text-[10px] text-text-error whitespace-nowrap bg-white border border-card-border rounded-lg px-2 py-1 shadow-sm z-10"
            >
              {statusError}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-4">
        <PopoverDetail
          label="Speciality"
          value={appointment.appointmentType?.speciality?.name || '-'}
        />
        <PopoverDetail
          label="Duration"
          value={formatTimeRange(appointment)}
          icon={<IoTimeOutline size={14} aria-hidden="true" />}
        />
        <PopoverDetail label="Service" value={appointment.appointmentType?.name || '-'} />
        <PopoverDetail label="Date" value={formatAppointmentDate(appointment)} />
        <PopoverDetail label="Reason" value={appointment.concern || '-'} />
        <PopoverDetail label={paymentTitle} value={paymentValue} emphasized />
        <PopoverDetail
          label="Parent"
          value={getOwnerFirstName(appointment.companion.parent) || '-'}
        />
        <PopoverDetail label="Room" value={appointment.room?.name || '-'} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StaffInput label="Lead" value={appointment.lead?.name || '-'} />
        <StaffInput label="Support" value={supportStaffValue} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        {canEditAppointments && isRequestedLikeStatus(appointment.status) && (
          <>
            <GlassTooltip content="Accept request" side="top">
              <button
                type="button"
                title="Accept request"
                aria-label="Accept request"
                className="h-12 w-12 shrink-0 rounded-full! flex items-center justify-center hover:bg-success-100 border border-card-border"
                onClick={async () => {
                  await acceptAppointment(appointment);
                  onClose();
                }}
              >
                <FaCheckCircle size={18} color="var(--color-success-400)" aria-hidden="true" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Decline request" side="top">
              <button
                type="button"
                title="Decline request"
                aria-label="Decline request"
                className="h-12 w-12 shrink-0 rounded-full! flex items-center justify-center hover:bg-danger-100 border border-card-border"
                onClick={async () => {
                  await rejectAppointment(appointment);
                  onClose();
                }}
              >
                <IoIosCloseCircle size={20} color="var(--color-danger-600)" aria-hidden="true" />
              </button>
            </GlassTooltip>
          </>
        )}
        {!isRequestedLikeStatus(appointment.status) && (
          <div
            className="scrollbar-hidden flex w-48 shrink-0 items-center gap-2 overflow-x-auto pr-1"
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.preventDefault();
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            <GlassTooltip content="Overview" side="top">
              <button
                type="button"
                title="Appointment overview"
                aria-label="Appointment overview"
                className="h-12 w-12 shrink-0 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
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
                <RiHistoryLine size={20} aria-hidden="true" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Finance summary" side="top">
              <button
                type="button"
                title="Finance summary"
                aria-label="Finance summary"
                className="h-12 w-12 shrink-0 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment, { label: 'finance', subLabel: 'summary' });
                  onClose();
                }}
              >
                <IoCardOutline size={20} aria-hidden="true" />
              </button>
            </GlassTooltip>
            <GlassTooltip content="Lab tests" side="top">
              <button
                type="button"
                title="Lab tests"
                aria-label="Lab tests"
                className="h-12 w-12 shrink-0 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment, { label: 'labs', subLabel: 'idexx-labs' });
                  onClose();
                }}
              >
                <IoFlaskOutline size={20} aria-hidden="true" />
              </button>
            </GlassTooltip>
            {canEditAppointments && allowReschedule(appointment.status) && (
              <GlassTooltip content="Reschedule" side="top">
                <button
                  type="button"
                  title="Reschedule"
                  aria-label="Reschedule appointment"
                  className="h-12 w-12 shrink-0 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                  onClick={() => {
                    handleRescheduleAppointment(appointment);
                    onClose();
                  }}
                >
                  <IoCalendarOutline size={20} aria-hidden="true" />
                </button>
              </GlassTooltip>
            )}
            {canEditAppointments && canAssignAppointmentRoom(appointment.status) && (
              <GlassTooltip content="Assign room" side="top">
                <button
                  type="button"
                  title="Assign room"
                  aria-label="Assign room"
                  className="h-12 w-12 shrink-0 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                  onClick={() => {
                    handleChangeRoomAppointment?.(appointment);
                    onClose();
                  }}
                >
                  <MdMeetingRoom size={20} aria-hidden="true" />
                </button>
              </GlassTooltip>
            )}
            <GlassTooltip content={clinicalNotesLabel} side="top">
              <button
                type="button"
                title={clinicalNotesLabel}
                aria-label={clinicalNotesLabel}
                className="h-12 w-12 shrink-0 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
                onClick={() => {
                  handleViewAppointment(appointment, clinicalNotesIntent);
                  onClose();
                }}
              >
                <IoDocumentTextOutline size={20} aria-hidden="true" />
              </button>
            </GlassTooltip>
          </div>
        )}
        <button
          type="button"
          title={primaryActionLabel}
          className="flex h-12 w-50 shrink-0 items-center justify-end gap-2 rounded-2xl! bg-black-bg px-4 font-satoshi text-[16px] font-medium leading-[120%] tracking-[-0.02rem] text-white-text hover:bg-black-hover"
          onClick={() => {
            handleViewAppointment(
              appointment,
              appointment.status === 'UPCOMING' ? clinicalNotesIntent : undefined
            );
            onClose();
          }}
        >
          <span className="whitespace-nowrap">{primaryActionLabel}</span>
          <IoArrowForward size={18} className="shrink-0" />
        </button>
      </div>

      {/* Status dropdown portal — hover events handled via registerAnchorEl */}
      {statusDropdownOpen &&
        createPortal(
          <div
            id={statusMenuId}
            ref={statusPanelRef}
            data-popover-panel="true"
            role="menu"
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-2xl! bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden whitespace-nowrap"
            style={{
              ...dropdownStyle,
              minWidth: 120,
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
                  role="menuitem"
                  disabled={savingStatus}
                  onClick={() => void handleStatusChange(nextStatus)}
                  className="flex h-8 w-full items-center gap-1 rounded-none! px-3 py-2 text-left transition-colors hover:bg-card-hover"
                  style={{
                    fontFamily: 'var(--font-satoshi), sans-serif',
                    fontSize: '14px',
                    fontWeight: 500,
                    lineHeight: '120%',
                    letterSpacing: '-0.28px',
                  }}
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

const AppointmentPopover = React.memo(AppointmentPopoverComponent);
export default AppointmentPopover;
