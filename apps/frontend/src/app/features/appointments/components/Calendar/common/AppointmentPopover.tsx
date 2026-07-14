import React, { useId } from 'react';
import { useRouter } from 'next/navigation';
import PopoverDetail from './PopoverDetail';
import StaffInput from './StaffInput';
import {
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
} from '@/app/lib/appointments';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';
import { getAppointmentPaymentDisplay } from '@/app/lib/paymentStatus';
import { normalizeAppointmentId } from '@/app/lib/invoice';
import { formatMoney } from '@/app/lib/money';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { Appointment, Invoice } from '@yosemite-crew/types';
import { useOrgStore } from '@/app/stores/orgStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import {
  buildWorkspaceHrefForIntent,
  canEnterAppointmentWorkspace,
} from '@/app/lib/appointmentWorkspace';
import { IoArrowForward, IoTimeOutline } from 'react-icons/io5';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import { getAppointmentRoomDisplay } from '@/app/lib/appointmentRoomDisplay';
import PopoverHeader from '@/app/features/appointments/components/Calendar/common/PopoverHeader';
import RequestActionButtons from '@/app/features/appointments/components/Calendar/common/RequestActionButtons';
import WorkspaceQuickActions from '@/app/features/appointments/components/Calendar/common/WorkspaceQuickActions';
import { CompanionWeightSource } from '@/app/features/appointments/components/Calendar/common/appointmentPopoverHelpers';

type AppointmentPopoverProps = {
  appointment: Appointment;
  invoicesByAppointmentId: Record<string, Invoice>;
  canEditAppointments: boolean;
  popoverId: string;
  popoverDialogRef: React.RefObject<HTMLDialogElement | null>;
  popoverStyle: React.CSSProperties;
  handleRescheduleAppointment: (appt: Appointment) => void;
  handleChangeRoomAppointment?: (appt: Appointment) => void;
  handleAcceptAppointment?: (appt: Appointment) => void;
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

const updatePrimaryActionGlowPosition = (event: React.PointerEvent<HTMLButtonElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--yc-button-x', `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty('--yc-button-y', `${event.clientY - rect.top}px`);
};

const AppointmentPopoverComponent: React.FC<AppointmentPopoverProps> = ({
  appointment,
  invoicesByAppointmentId,
  canEditAppointments,
  popoverId,
  popoverDialogRef,
  popoverStyle,
  handleRescheduleAppointment,
  handleChangeRoomAppointment,
  handleAcceptAppointment,
  onClose,
  registerAnchorEl,
}) => {
  const router = useRouter();
  const orgsById = useOrgStore((s) => s.orgsById);
  const encountersById = useAppointmentWorkspaceStore((s) => s.encountersById);
  const roomUnitsById = useOrganisationRoomStore((s) => s.roomUnitsById);
  const companion = appointment.companion ?? appointment.patient;
  const storeCompanion = useCompanionStore((s) => s.getCompanionById(companion.id));
  const companionDetails = {
    ...storeCompanion,
    ...companion,
    currentWeight:
      (companion as CompanionWeightSource).currentWeight ?? storeCompanion?.currentWeight,
    physicalAttribute:
      (companion as CompanionWeightSource).physicalAttribute ?? storeCompanion?.physicalAttribute,
  } as CompanionWeightSource & typeof companion;
  const payment = getAppointmentPaymentDisplay(appointment, invoicesByAppointmentId);
  const companionDisplayName = getCompanionDisplayName(appointment);
  const orgType =
    (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';
  const clinicalNotesLabel = getClinicalNotesLabel(orgType);
  const clinicalNotesIntent = getClinicalNotesIntent(orgType);

  const titleId = useId();
  const onActionBarWheel = useWheelToHorizontalScroll({ ignoreAncestors: true });

  const appointmentInvoice = getInvoiceForAppointment(appointment.id, invoicesByAppointmentId);
  const paymentTitle = getPaymentTitle(payment?.state);
  const paymentValue = getPaymentValue(payment?.label, appointmentInvoice);
  const supportStaffValue = appointment.supportStaff?.map((staff) => staff.name).join(', ') || '-';
  const roomDisplay = getAppointmentRoomDisplay(appointment, encountersById, roomUnitsById);
  const canOpenWorkspace = canEnterAppointmentWorkspace(appointment.status);
  const primaryActionLabel =
    appointment.status === 'UPCOMING' ? 'Start Appointment' : 'View Appointment';
  const openWorkspace = (intent?: AppointmentViewIntent) => {
    if (!appointment.id) return;
    if (!canOpenWorkspace) {
      onClose();
      return;
    }
    router.push(buildWorkspaceHrefForIntent(appointment.id, intent));
    onClose();
  };

  return (
    <dialog
      id={popoverId}
      ref={popoverDialogRef}
      open
      className="yc-glass-overlay fixed z-[1000] w-[440px] rounded-3xl p-5"
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
      <PopoverHeader
        appointment={appointment}
        companion={companion}
        companionDetails={companionDetails}
        companionDisplayName={companionDisplayName}
        canEditAppointments={canEditAppointments}
        titleId={titleId}
        registerAnchorEl={registerAnchorEl}
        onClose={onClose}
      />

      <div className="mt-4 grid grid-cols-2 gap-x-7 gap-y-5 px-1">
        <PopoverDetail
          label="Speciality"
          value={appointment.appointmentType?.speciality?.name || '-'}
        />
        <PopoverDetail
          label="Duration"
          value={formatTimeRange(appointment)}
          icon={<IoTimeOutline size={14} className="text-neutral-900" aria-hidden="true" />}
        />
        <PopoverDetail label="Service" value={appointment.appointmentType?.name || '-'} />
        <PopoverDetail label="Date" value={formatAppointmentDate(appointment)} />
        <PopoverDetail label={roomDisplay.label} value={roomDisplay.value} />
        <PopoverDetail label="Client Name" value={getOwnerFirstName(companion.parent) || '-'} />
        <PopoverDetail label="Reason" value={appointment.concern || '-'} scrollValue />
        <PopoverDetail label={paymentTitle} value={paymentValue} emphasized />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 px-1">
        <StaffInput label="Lead" value={appointment.lead?.name || '-'} />
        <StaffInput label="Support" value={supportStaffValue} />
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 px-1">
        {canEditAppointments && isRequestedLikeStatus(appointment.status) && (
          <RequestActionButtons
            appointment={appointment}
            onAccept={handleAcceptAppointment}
            onClose={onClose}
          />
        )}
        {!isRequestedLikeStatus(appointment.status) && canOpenWorkspace && (
          <WorkspaceQuickActions
            appointment={appointment}
            canEditAppointments={canEditAppointments}
            clinicalNotesLabel={clinicalNotesLabel}
            onActionBarWheel={onActionBarWheel}
            onOpenCompanionHistory={() => {
              router.push(
                buildAppointmentCompanionHistoryHref(
                  appointment.id,
                  appointment.companion?.id,
                  '/appointments'
                )
              );
              onClose();
            }}
            onOpenWorkspace={(intent) =>
              intent ? openWorkspace(intent) : openWorkspace(clinicalNotesIntent)
            }
            onReschedule={() => {
              handleRescheduleAppointment(appointment);
              onClose();
            }}
            onChangeRoom={() => {
              handleChangeRoomAppointment?.(appointment);
              onClose();
            }}
          />
        )}
        {canOpenWorkspace && (
          <button
            type="button"
            title={primaryActionLabel}
            className="yc-primary-button text-yc-16-m-white flex h-12 w-50 shrink-0 items-center justify-end gap-2 rounded-2xl! px-4"
            onPointerDown={updatePrimaryActionGlowPosition}
            onPointerMove={updatePrimaryActionGlowPosition}
            onClick={() => {
              openWorkspace(appointment.status === 'UPCOMING' ? clinicalNotesIntent : undefined);
            }}
          >
            <span className="whitespace-nowrap">{primaryActionLabel}</span>
            <IoArrowForward size={18} className="shrink-0" />
          </button>
        )}
      </div>
    </dialog>
  );
};

const AppointmentPopover = React.memo(AppointmentPopoverComponent);
export default AppointmentPopover;
