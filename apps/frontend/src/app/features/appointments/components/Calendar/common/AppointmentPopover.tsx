import React, { useId } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import PopoverDetail from './PopoverDetail';
import StaffInput from './StaffInput';
import AppointmentStatusPill from '@/app/features/appointments/components/AppointmentStatusPill';
import EmergencyBadge from '@/app/features/appointments/components/EmergencyBadge';
import { AppointmentModePill } from '@/app/features/appointments/components/AppointmentCardContent';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import {
  allowReschedule,
  canAssignAppointmentRoom,
  getAppointmentCompanionPhotoUrl,
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
} from '@/app/lib/appointments';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';
import { formatCompanionNameWithOwnerLastName, getOwnerFirstName } from '@/app/lib/companionName';
import { getAppointmentPaymentDisplay } from '@/app/lib/paymentStatus';
import { normalizeAppointmentId } from '@/app/lib/invoice';
import { formatMoney } from '@/app/lib/money';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { rejectAppointment } from '@/app/features/appointments/services/appointmentService';
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
import {
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoCardOutline,
  IoFlaskOutline,
  IoArrowForward,
  IoTimeOutline,
} from 'react-icons/io5';
import { MdMeetingRoom } from 'react-icons/md';
import { RiHistoryLine } from 'react-icons/ri';
import { FaCheckCircle } from 'react-icons/fa';
import { IoIosCloseCircle } from 'react-icons/io';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import { getAppointmentRoomDisplay } from '@/app/lib/appointmentRoomDisplay';

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

const SPECIES_DISPLAY: Record<string, string> = {
  dog: 'Canine',
  cat: 'Feline',
  horse: 'Equine',
  other: 'Other',
};

const getCompanionGenderLabel = (gender?: string, isneutered?: boolean): string => {
  if (gender === 'male') return isneutered ? 'MN' : 'Male';
  if (gender === 'female') return isneutered ? 'FS' : 'Female';
  return 'Unknown';
};

const getCompanionAge = (dateOfBirth?: Date): string => {
  if (!dateOfBirth) return '';
  const dob = new Date(dateOfBirth);
  const now = new Date();
  const years = now.getFullYear() - dob.getFullYear();
  const months = now.getMonth() - dob.getMonth() + (now.getDate() < dob.getDate() ? -1 : 0);
  const totalMonths = years * 12 + months;
  if (totalMonths < 1) return '< 1m';
  if (totalMonths < 12) return `${totalMonths}m`;
  const wholeYears = Math.floor(totalMonths / 12);
  const remMonths = totalMonths % 12;
  return remMonths > 0 ? `${wholeYears}y ${remMonths}m` : `${wholeYears}y`;
};

type CompanionWeightSource = Appointment['companion'] & {
  currentWeight?: number | string;
  physicalAttribute?: { weight?: string };
};

const getCompanionWeightLabel = (companion: CompanionWeightSource): string => {
  const weight = companion.currentWeight;
  if (weight === undefined || weight === null || weight === '') {
    return '';
  }
  const numericWeight = typeof weight === 'number' ? weight : Number(weight);
  if (Number.isFinite(numericWeight) && numericWeight > 0) {
    return `${Number.isInteger(numericWeight) ? numericWeight : numericWeight.toFixed(1)} lbs`;
  }
  const physicalWeight = companion.physicalAttribute?.weight?.trim();
  return physicalWeight || '';
};

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
      className="fixed z-[1000] w-[440px] rounded-3xl border border-card-border bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,0.14)]"
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
      <div className="flex items-center justify-between gap-3 border-b border-card-border pb-4">
        <div className="min-w-0 flex items-center gap-3">
          <Image
            src={getSafeImageUrl(
              getAppointmentCompanionPhotoUrl(companion),
              companion.species.toLowerCase() as ImageType
            )}
            height={48}
            width={48}
            className="flex aspect-square size-12 shrink-0 items-center justify-center rounded-full border border-card-border bg-white object-cover"
            style={{ width: 48, height: 48 }}
            alt=""
          />
          <div className="min-w-0">
            <button
              type="button"
              id={titleId}
              className="text-yc-20-b-neutral block max-w-full truncate cursor-pointer underline-offset-2 hover:underline"
              onClick={() => {
                router.push(
                  buildAppointmentCompanionHistoryHref(
                    appointment.id,
                    companion.id,
                    '/appointments'
                  )
                );
                onClose();
              }}
              title="Open appointment overview"
            >
              {companionDisplayName}
            </button>
            <div className="text-yc-12-m-neutral mt-1 line-clamp-2 text-left break-words">
              {(() => {
                const c = companionDetails as typeof companionDetails & {
                  gender?: string;
                  dateOfBirth?: Date;
                  isneutered?: boolean;
                };
                const rawSpecies = companionDetails.species || '';
                const speciesLabel =
                  (SPECIES_DISPLAY[rawSpecies.toLowerCase()] ?? rawSpecies) || '-';
                const parts: string[] = [];
                const breed = companionDetails.breed;
                if (breed) parts.push(breed);
                if (speciesLabel) parts.push(speciesLabel);
                const age = getCompanionAge(c.dateOfBirth);
                if (age) parts.push(age);
                parts.push(getCompanionGenderLabel(c.gender, c.isneutered));
                const weight = getCompanionWeightLabel(companionDetails);
                if (weight) parts.push(weight);
                return parts.join(' · ');
              })()}
            </div>
          </div>
        </div>

        {/* Status pill — shared component (dropdown trigger when changeable). */}
        <div className="relative shrink-0 flex flex-col items-end gap-1.5">
          <AppointmentStatusPill
            appointment={appointment}
            canEdit={canEditAppointments}
            onChanged={onClose}
            registerAnchorEl={registerAnchorEl}
          />
          <AppointmentModePill appointment={appointment} className="w-fit" />

          {appointment.isEmergency && <EmergencyBadge />}
        </div>
      </div>

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
          <div className="flex shrink-0 items-center gap-2">
            <GlassTooltip content="Accept request" side="top">
              <button
                type="button"
                title="Accept request"
                aria-label="Accept request"
                className="flex size-10 shrink-0 items-center justify-center rounded-full! border border-success-200 bg-success-100 hover:bg-success-200"
                onClick={() => {
                  handleAcceptAppointment?.(appointment);
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
                className="flex size-10 shrink-0 items-center justify-center rounded-full! border border-danger-200 bg-danger-100 hover:bg-danger-200"
                onClick={async () => {
                  await rejectAppointment(appointment);
                  onClose();
                }}
              >
                <IoIosCloseCircle size={20} color="var(--color-danger-600)" aria-hidden="true" />
              </button>
            </GlassTooltip>
          </div>
        )}
        {!isRequestedLikeStatus(appointment.status) && canOpenWorkspace && (
          <div
            className="scrollbar-hidden flex w-48 shrink-0 items-center gap-2 overflow-x-auto pr-1"
            onWheel={onActionBarWheel}
          >
            <GlassTooltip content="Overview" side="top">
              <button
                type="button"
                title="Appointment overview"
                aria-label="Appointment overview"
                className="flex size-12 shrink-0 items-center justify-center rounded-full! border-[1.2px] border-neutral-900 bg-white p-3 text-neutral-900 shadow-[0_1px_8px_1px_rgba(169,163,158,0.10)] hover:bg-card-bg"
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
                className="flex size-12 shrink-0 items-center justify-center rounded-full! border-[1.2px] border-neutral-900 bg-white p-3 text-neutral-900 shadow-[0_1px_8px_1px_rgba(169,163,158,0.10)] hover:bg-card-bg"
                onClick={() => {
                  openWorkspace({ label: 'finance', subLabel: 'summary' });
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
                className="flex size-12 shrink-0 items-center justify-center rounded-full! border-[1.2px] border-neutral-900 bg-white p-3 text-neutral-900 shadow-[0_1px_8px_1px_rgba(169,163,158,0.10)] hover:bg-card-bg"
                onClick={() => {
                  openWorkspace({ label: 'labs', subLabel: 'idexx-labs' });
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
                  className="flex size-12 shrink-0 items-center justify-center rounded-full! border-[1.2px] border-neutral-900 bg-white p-3 text-neutral-900 shadow-[0_1px_8px_1px_rgba(169,163,158,0.10)] hover:bg-card-bg"
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
                  className="flex size-12 shrink-0 items-center justify-center rounded-full! border-[1.2px] border-neutral-900 bg-white p-3 text-neutral-900 shadow-[0_1px_8px_1px_rgba(169,163,158,0.10)] hover:bg-card-bg"
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
                className="flex size-12 shrink-0 items-center justify-center rounded-full! border-[1.2px] border-neutral-900 bg-white p-3 text-neutral-900 shadow-[0_1px_8px_1px_rgba(169,163,158,0.10)] hover:bg-card-bg"
                onClick={() => {
                  openWorkspace(clinicalNotesIntent);
                }}
              >
                <IoDocumentTextOutline size={20} aria-hidden="true" />
              </button>
            </GlassTooltip>
          </div>
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
