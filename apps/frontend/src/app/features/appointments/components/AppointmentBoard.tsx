import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBoardDragScroll } from '@/app/hooks/useBoardDragScroll';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import { buildDragPreview } from '@/app/lib/buildDragPreview';
import AppointmentScopeToggle from '@/app/ui/primitives/AppointmentScopeToggle/AppointmentScopeToggle';
import { Appointment } from '@yosemite-crew/types';
import { getStatusStyle } from '@/app/config/statusConfig';
import {
  acceptAppointment,
  changeAppointmentStatus,
  rejectAppointment,
} from '@/app/features/appointments/services/appointmentService';
import {
  isOnPreferredTimeZoneCalendarDay,
  formatDateInPreferredTimeZone,
} from '@/app/lib/timezone';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useAuthStore } from '@/app/stores/authStore';
import Datepicker from '@/app/ui/inputs/Datepicker';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import {
  createInvoiceByAppointmentId,
  getAppointmentPaymentDisplay,
} from '@/app/lib/paymentStatus';
import {
  IoAdd,
  IoCardOutline,
  IoDocumentTextOutline,
  IoEyeOutline,
  IoWarning,
} from 'react-icons/io5';
import { RiHistoryLine } from 'react-icons/ri';
import Image from 'next/image';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { FaCheckCircle } from 'react-icons/fa';
import { IoIosCalendar, IoIosCloseCircle } from 'react-icons/io';
import {
  allowCalendarDrag,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  canTransitionAppointmentStatus,
  getAppointmentCompanionPhotoUrl,
  getAllowedAppointmentStatusTransitions,
  getPreferredNextAppointmentStatus,
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  getInvalidAppointmentStatusTransitionMessage,
  isRequestedLikeStatus,
  normalizeAppointmentStatus,
} from '@/app/lib/appointments';
import { MdMeetingRoom, MdOutlineAutorenew, MdScience } from 'react-icons/md';
import { useOrgStore } from '@/app/stores/orgStore';
import { useNotify } from '@/app/hooks/useNotify';
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import { Primary } from '@/app/ui/primitives/Buttons';
import clsx from 'clsx';

type BoardStatus =
  | 'REQUESTED'
  | 'UPCOMING'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

const BOARD_COLUMNS: Array<{ key: BoardStatus; label: string }> = [
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'CHECKED_IN', label: 'Checked-in' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'NO_SHOW', label: 'No show' },
];

const normalizeStatus = (status?: string): BoardStatus | null => {
  return normalizeAppointmentStatus(status);
};

const getEmergencyPillStyle = (isActive: boolean): React.CSSProperties => ({
  backgroundColor: isActive ? 'var(--color-semantic-error-100)' : 'var(--color-neutral-0)',
  borderColor: isActive ? 'var(--color-semantic-error-500)' : 'var(--color-neutral-500)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderRadius: '16px',
  boxShadow: '0 1px 10px 0 rgba(169, 163, 158, 0.10)',
  color: isActive ? 'var(--color-semantic-error-700)' : 'var(--color-neutral-700)',
});

const getBoardOrgType = (
  appointment: Appointment,
  orgsById: Record<string, { type?: string } | undefined>
) => {
  return (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';
};

const AppointmentPaymentBadge = ({
  appointment,
  invoicesByAppointmentId,
}: {
  appointment: Appointment;
  invoicesByAppointmentId: ReturnType<typeof createInvoiceByAppointmentId>;
}) => {
  const payment = getAppointmentPaymentDisplay(appointment, invoicesByAppointmentId);
  return (
    <div
      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium font-satoshi"
      style={{
        backgroundColor: payment.badgeBackgroundColor,
        color: payment.badgeTextColor,
      }}
    >
      {payment.label}
    </div>
  );
};

type AppointmentBoardProps = {
  appointments: Appointment[];
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  canEditAppointments: boolean;
  setActiveAppointment?: (appointment: Appointment) => void;
  setViewPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setDetailPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setViewIntent?: (intent: AppointmentViewIntent | null) => void;
  setChangeStatusPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeStatusPreferredStatus?: React.Dispatch<React.SetStateAction<AppointmentStatus | null>>;
  setReschedulePopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeRoomPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  onAddAppointment?: () => void;
  activeFilter?: string;
  setActiveFilter?: (value: string) => void;
  hasEmergency?: boolean;
};

const AppointmentBoardComponent = ({
  appointments,
  currentDate,
  setCurrentDate,
  canEditAppointments,
  setActiveAppointment,
  setViewPopup,
  setDetailPopup,
  setViewIntent,
  setChangeStatusPopup,
  setChangeStatusPreferredStatus,
  setReschedulePopup,
  setChangeRoomPopup,
  onAddAppointment,
  activeFilter,
  setActiveFilter,
  hasEmergency = false,
}: AppointmentBoardProps) => {
  const { notify } = useNotify();
  const orgsById = useOrgStore((s) => s.orgsById);
  const team = useTeamForPrimaryOrg();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const [draggedAppointmentId, setDraggedAppointmentId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const boardRootRef = useRef<HTMLDivElement | null>(null);
  const columnDropRefs = useRef<Partial<Record<BoardStatus, HTMLDivElement | null>>>({});
  const columnScrollRefs = useRef<Partial<Record<BoardStatus, HTMLDivElement | null>>>({});
  const invoices = useInvoicesForPrimaryOrg();
  const invoicesByAppointmentId = useMemo(() => createInvoiceByAppointmentId(invoices), [invoices]);

  const normalizeId = (value?: string | null) =>
    String(value ?? '')
      .trim()
      .split('/')
      .pop()
      ?.toLowerCase() ?? '';

  const currentUserLeadId = useMemo(() => {
    const normalizedCurrentUser = normalizeId(authUserId);
    if (!normalizedCurrentUser) return '';
    const member = team.find(
      (item) =>
        normalizeId(item.practionerId) === normalizedCurrentUser ||
        normalizeId(item._id) === normalizedCurrentUser ||
        normalizeId((item as any).userId) === normalizedCurrentUser ||
        normalizeId((item as any).id) === normalizedCurrentUser ||
        normalizeId((item as any).userOrganisation?.userId) === normalizedCurrentUser
    );
    return normalizeId(member?.practionerId || member?._id);
  }, [authUserId, team]);

  const todayAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) =>
          isOnPreferredTimeZoneCalendarDay(appointment.startTime, currentDate)
        )
        .filter((appointment) =>
          showMineOnly ? normalizeId(appointment.lead?.id) === currentUserLeadId : true
        )
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    [appointments, currentDate, currentUserLeadId, showMineOnly]
  );

  const groupedAppointments = useMemo(() => {
    const grouped: Record<BoardStatus, Appointment[]> = {
      REQUESTED: [],
      UPCOMING: [],
      CHECKED_IN: [],
      IN_PROGRESS: [],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    };
    todayAppointments.forEach((appointment) => {
      const status = normalizeStatus(appointment.status);
      if (!status) return;
      grouped[status].push(appointment);
    });
    return grouped;
  }, [todayAppointments]);
  const router = useRouter();
  const toggleEmergencyFilter = () => {
    if (!setActiveFilter) return;
    setActiveFilter(activeFilter === 'emergencies' ? 'all' : 'emergencies');
  };
  const isEmergencyActive = activeFilter === 'emergencies';
  const emergencyColor = isEmergencyActive
    ? 'var(--color-semantic-error-700)'
    : 'var(--color-neutral-700)';

  const openAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setViewIntent?.(null);
    setDetailPopup?.(true);
  };

  const openAppointmentOverview = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setViewIntent?.(null);
    setViewPopup?.(true);
  };

  const openAppointmentWithIntent = (appointment: Appointment, intent?: AppointmentViewIntent) => {
    setActiveAppointment?.(appointment);
    setViewIntent?.(intent ?? null);
    setDetailPopup?.(true);
  };

  const openAppointmentHistory = (appointment: Appointment) => {
    router.push(
      buildAppointmentCompanionHistoryHref(
        appointment.id,
        appointment.companion?.id,
        '/appointments'
      )
    );
  };

  const openChangeStatus = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setChangeStatusPreferredStatus?.(getPreferredNextAppointmentStatus(appointment.status));
    setChangeStatusPopup?.(true);
  };

  const openReschedule = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setReschedulePopup?.(true);
  };

  const openChangeRoom = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setChangeRoomPopup?.(true);
  };

  const { autoScrollBoardOnDrag } = useBoardDragScroll();
  const onWheelHorizontal = useWheelToHorizontalScroll();

  const moveToStatus = useCallback(
    async (appointmentId: string, nextStatus: BoardStatus) => {
      const appointment = todayAppointments.find((item) => item.id === appointmentId);
      if (!appointment?.id) return;
      const currentStatus = normalizeStatus(appointment.status);
      if (currentStatus === nextStatus) return;
      if (!canEditAppointments) return;
      if (!canTransitionAppointmentStatus(appointment.status, nextStatus)) {
        notify('warning', {
          title: 'Status change blocked',
          text: getInvalidAppointmentStatusTransitionMessage(appointment.status, nextStatus),
        });
        return;
      }

      try {
        setUpdatingStatusId(appointment.id);
        await changeAppointmentStatus(appointment, nextStatus);
      } finally {
        setUpdatingStatusId(null);
      }
    },
    [canEditAppointments, notify, todayAppointments]
  );

  const handleAppointmentDragStart = (
    event: React.DragEvent<HTMLElement>,
    appointmentId?: string | null
  ) => {
    setDraggedAppointmentId(appointmentId ?? null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', appointmentId ?? '');
    const preview = buildDragPreview(event.currentTarget, {
      scale: 0.94,
      transformOrigin: 'top left',
    });
    event.dataTransfer.setDragImage(preview, 24, 24);
    requestAnimationFrame(() => {
      preview.remove();
    });
  };

  const handleDroppedAppointmentStatus = useCallback(
    (appointmentId: string, nextStatus: BoardStatus) => {
      void moveToStatus(appointmentId, nextStatus).finally(() => {
        setDraggedAppointmentId(null);
      });
    },
    [moveToStatus]
  );

  useEffect(() => {
    const boardRoot = boardRootRef.current;
    if (!boardRoot) return;

    const handleBoardDragOver = (event: DragEvent) => {
      if (!draggedAppointmentId || !canEditAppointments) return;
      autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>);
    };

    boardRoot.addEventListener('dragover', handleBoardDragOver);
    return () => boardRoot.removeEventListener('dragover', handleBoardDragOver);
  }, [autoScrollBoardOnDrag, canEditAppointments, draggedAppointmentId]);

  useEffect(() => {
    const cleanups = BOARD_COLUMNS.flatMap((column) => {
      const dropElement = columnDropRefs.current[column.key];
      const scrollElement = columnScrollRefs.current[column.key];
      if (!dropElement || !scrollElement) return [];

      const handleColumnDragOver = (event: DragEvent) => {
        if (!draggedAppointmentId || !canEditAppointments) return;
        event.preventDefault();
        autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>);
      };

      const handleColumnDrop = (event: DragEvent) => {
        if (!draggedAppointmentId || !canEditAppointments) return;
        event.preventDefault();
        handleDroppedAppointmentStatus(draggedAppointmentId, column.key);
      };

      const handleScrollDragOver = (event: DragEvent) => {
        if (!draggedAppointmentId || !canEditAppointments) return;
        event.preventDefault();
        autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>, scrollElement);
      };

      dropElement.addEventListener('dragover', handleColumnDragOver);
      dropElement.addEventListener('drop', handleColumnDrop);
      scrollElement.addEventListener('dragover', handleScrollDragOver);

      return [
        () => dropElement.removeEventListener('dragover', handleColumnDragOver),
        () => dropElement.removeEventListener('drop', handleColumnDrop),
        () => scrollElement.removeEventListener('dragover', handleScrollDragOver),
      ];
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    autoScrollBoardOnDrag,
    canEditAppointments,
    draggedAppointmentId,
    handleDroppedAppointmentStatus,
  ]);

  return (
    <div className="h-full min-h-0 rounded-2xl border border-grey-light bg-white overflow-hidden flex flex-col">
      <div className="shrink-0 border-b border-grey-light bg-white px-3 py-2">
        <div className="flex w-full items-center gap-4">
          <div className="flex shrink-0 items-center gap-2 text-body-4-emphasis text-text-primary">
            <GlassTooltip content="Select date" side="bottom">
              <Datepicker
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                placeholder="Select Date"
              />
            </GlassTooltip>
            <div className="flex items-center gap-2">
              <Back
                onClick={() =>
                  setCurrentDate((prev) => {
                    const next = new Date(prev);
                    next.setDate(next.getDate() - 1);
                    return next;
                  })
                }
              />
              <div className="whitespace-nowrap">
                {formatDateInPreferredTimeZone(currentDate, {
                  weekday: 'long',
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                })}
              </div>
              <Next
                onClick={() =>
                  setCurrentDate((prev) => {
                    const next = new Date(prev);
                    next.setDate(next.getDate() + 1);
                    return next;
                  })
                }
              />
            </div>
          </div>
          <div
            className="relative z-20 min-w-0 flex-1 overflow-x-auto scrollbar-x-float py-1 -my-1"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
            onWheel={onWheelHorizontal}
          >
            <div className="flex w-max items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={toggleEmergencyFilter}
                className={clsx(
                  'relative flex h-12 w-fit shrink-0 items-center justify-center gap-2 whitespace-nowrap text-body-4 px-3 rounded-2xl! transition-all duration-300',
                  !isEmergencyActive && 'hover:bg-card-hover!'
                )}
                style={getEmergencyPillStyle(isEmergencyActive)}
              >
                <IoWarning
                  size={18}
                  aria-hidden="true"
                  className="shrink-0"
                  color={emergencyColor}
                />
                <span>Emergencies</span>
                {hasEmergency && (
                  <span
                    aria-label="Emergency appointments present"
                    className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--color-semantic-error-700)',
                      outline: '2px solid white',
                    }}
                  />
                )}
              </button>
              {canEditAppointments && (
                <>
                  <div className="h-8 w-px shrink-0 bg-card-border" aria-hidden="true" />
                  <Primary
                    text="Add Appointment"
                    onClick={onAddAppointment}
                    icon={<IoAdd size={18} aria-hidden="true" />}
                    className="h-12 w-fit shrink-0 justify-center gap-2 px-4 py-0 whitespace-nowrap hover:scale-100"
                  />
                </>
              )}
              <div className="shrink-0">
                <AppointmentScopeToggle showMineOnly={showMineOnly} onChange={setShowMineOnly} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        ref={boardRootRef}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-3 scrollbar-x-float"
        data-calendar-scroll="true"
        data-board-scroll-root="true"
        onWheel={onWheelHorizontal}
      >
        <div className="h-full min-w-max flex items-stretch gap-3">
          {BOARD_COLUMNS.map((column) => {
            const columnAppointments = groupedAppointments[column.key];
            const hasAppointments = columnAppointments.length > 0;
            const style = getStatusStyle(column.key);
            return (
              <div
                key={column.key}
                ref={(element) => {
                  columnDropRefs.current[column.key] = element;
                }}
                className="w-[320px] min-w-[320px] max-w-[320px] h-full rounded-2xl border border-card-border bg-white overflow-hidden flex flex-col min-h-0"
              >
                <div
                  className="rounded-t-2xl border-b px-3 py-2"
                  style={{
                    backgroundColor: style.backgroundColor,
                    borderBottomColor: style.borderColor,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-body-4-emphasis" style={{ color: style.color }}>
                      {column.label}
                    </div>
                    <div
                      className="text-caption-1 rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: style.backgroundColor,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: style.borderColor,
                        color: style.color,
                        opacity: 0.85,
                      }}
                    >
                      {columnAppointments.length}
                    </div>
                  </div>
                </div>
                <div
                  ref={(element) => {
                    columnScrollRefs.current[column.key] = element;
                  }}
                  className="flex-1 min-h-0 h-0 flex flex-col gap-2 p-3 pb-4 bg-white overflow-y-auto"
                  data-calendar-scroll="true"
                >
                  {columnAppointments.map((appointment) => {
                    const isCardDraggable =
                      canEditAppointments &&
                      getAllowedAppointmentStatusTransitions(appointment.status).length > 0;
                    const companionDisplayName = formatCompanionNameWithOwnerLastName(
                      appointment.companion.name,
                      appointment.companion.parent
                    );

                    return (
                      <article
                        key={appointment.id}
                        aria-label={
                          isCardDraggable
                            ? `Draggable appointment ${companionDisplayName}`
                            : `Open appointment ${companionDisplayName}`
                        }
                        className={`relative w-full min-h-[142px] shrink-0 rounded-2xl! overflow-hidden border border-card-border bg-white px-4 py-3 text-left transition-colors flex flex-col items-stretch justify-start ${
                          draggedAppointmentId === (appointment.id ?? null)
                            ? 'opacity-60 shadow-none'
                            : 'hover:border-input-border-active! hover:bg-card-hover!'
                        } ${isCardDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                        draggable={isCardDraggable}
                        onDragStart={(event) => handleAppointmentDragStart(event, appointment.id)}
                        onDragEnd={() => setDraggedAppointmentId(null)}
                        onClick={isCardDraggable ? undefined : () => openAppointment(appointment)}
                        onKeyDown={
                          isCardDraggable
                            ? undefined
                            : (e) => {
                                if (e.key === 'Enter' || e.key === ' ')
                                  openAppointment(appointment);
                              }
                        }
                        role={isCardDraggable ? undefined : 'button'}
                        tabIndex={isCardDraggable ? undefined : 0}
                      >
                        <div className="relative z-10 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-caption-1 font-semibold text-text-primary">
                              <button
                                type="button"
                                className="break-words cursor-pointer hover:underline underline-offset-2 text-left"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openAppointmentHistory(appointment);
                                }}
                                title="Open appointment overview"
                              >
                                {companionDisplayName}
                              </button>
                              <div className="break-words text-[10px] font-normal text-text-secondary">
                                Speciality: {appointment.appointmentType?.speciality?.name || '-'}
                              </div>
                              <div className="break-words text-[10px] font-normal text-text-secondary">
                                Service: {appointment.appointmentType?.name || '-'}
                              </div>
                              <div className="break-words text-[10px] font-normal text-text-secondary">
                                Reason: {appointment.concern || '-'}
                              </div>
                              <div className="break-words text-[10px] font-normal text-text-secondary">
                                Room: {appointment.room?.name || '-'}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Image
                              src={getSafeImageUrl(
                                getAppointmentCompanionPhotoUrl(appointment.companion),
                                appointment.companion.species.toLowerCase() as ImageType
                              )}
                              height={24}
                              width={24}
                              className="h-6 w-6 rounded-full border border-card-border bg-white object-cover"
                              alt=""
                            />
                            <div className="text-[10px] text-text-secondary whitespace-nowrap">
                              {formatDateInPreferredTimeZone(appointment.startTime, {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="relative z-10 pt-1 pb-1 border-t border-card-border/60 flex items-center justify-between gap-2">
                          <div className="text-[10px] text-text-secondary break-words">
                            Lead: {appointment.lead?.name || '-'}
                          </div>
                          <AppointmentPaymentBadge
                            appointment={appointment}
                            invoicesByAppointmentId={invoicesByAppointmentId}
                          />
                        </div>
                        {isRequestedLikeStatus(appointment.status) && (
                          <div className="relative z-10 mt-2 flex items-center justify-end gap-1">
                            <GlassTooltip content="Accept request" side="bottom">
                              <button
                                type="button"
                                className="h-7 w-7 rounded-full! bg-success-100 border border-success-200 flex items-center justify-center"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void acceptAppointment(appointment);
                                }}
                              >
                                <FaCheckCircle size={14} color="var(--color-success-400)" />
                              </button>
                            </GlassTooltip>
                            <GlassTooltip content="Decline request" side="bottom">
                              <button
                                type="button"
                                className="h-7 w-7 rounded-full! bg-danger-100 border border-danger-200 flex items-center justify-center"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void rejectAppointment(appointment);
                                }}
                              >
                                <IoIosCloseCircle size={16} color="var(--color-danger-600)" />
                              </button>
                            </GlassTooltip>
                          </div>
                        )}
                        {!isRequestedLikeStatus(appointment.status) && (
                          <div className="relative z-10 mt-2 flex items-center gap-1.5 flex-wrap max-w-[184px]">
                            <GlassTooltip content="View appointment" side="bottom">
                              <button
                                type="button"
                                className="h-8 w-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openAppointmentOverview(appointment);
                                }}
                              >
                                <IoEyeOutline size={16} color="var(--color-neutral-900)" />
                              </button>
                            </GlassTooltip>
                            <GlassTooltip content="Overview" side="bottom">
                              <button
                                type="button"
                                className="h-8 w-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openAppointmentHistory(appointment);
                                }}
                                title="Appointment overview"
                              >
                                <RiHistoryLine size={15} color="var(--color-neutral-900)" />
                              </button>
                            </GlassTooltip>
                            {canEditAppointments &&
                              canShowStatusChangeAction(appointment.status) && (
                                <GlassTooltip content="Change status" side="bottom">
                                  <button
                                    type="button"
                                    className="h-8 w-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      openChangeStatus(appointment);
                                    }}
                                  >
                                    <MdOutlineAutorenew
                                      size={15}
                                      color="var(--color-neutral-900)"
                                    />
                                  </button>
                                </GlassTooltip>
                              )}
                            {canEditAppointments && allowCalendarDrag(appointment.status) && (
                              <GlassTooltip content="Reschedule" side="bottom">
                                <button
                                  type="button"
                                  className="h-8 w-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openReschedule(appointment);
                                  }}
                                >
                                  <IoIosCalendar size={15} color="var(--color-neutral-900)" />
                                </button>
                              </GlassTooltip>
                            )}
                            {canEditAppointments &&
                              canAssignAppointmentRoom(appointment.status) && (
                                <GlassTooltip content="Assign room" side="bottom">
                                  <button
                                    type="button"
                                    className="h-8 w-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      openChangeRoom(appointment);
                                    }}
                                  >
                                    <MdMeetingRoom size={15} color="var(--color-neutral-900)" />
                                  </button>
                                </GlassTooltip>
                              )}
                            <GlassTooltip
                              content={getClinicalNotesLabel(
                                getBoardOrgType(appointment, orgsById)
                              )}
                              side="bottom"
                            >
                              <button
                                type="button"
                                className="h-8 w-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openAppointmentWithIntent(
                                    appointment,
                                    getClinicalNotesIntent(getBoardOrgType(appointment, orgsById))
                                  );
                                }}
                                title={getClinicalNotesLabel(
                                  getBoardOrgType(appointment, orgsById)
                                )}
                              >
                                <IoDocumentTextOutline size={15} color="var(--color-neutral-900)" />
                              </button>
                            </GlassTooltip>
                            <GlassTooltip content="Finance summary" side="bottom">
                              <button
                                type="button"
                                className="h-8 w-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openAppointmentWithIntent(appointment, {
                                    label: 'finance',
                                    subLabel: 'summary',
                                  });
                                }}
                              >
                                <IoCardOutline size={15} color="var(--color-neutral-900)" />
                              </button>
                            </GlassTooltip>
                            <GlassTooltip content="Lab tests" side="bottom">
                              <button
                                type="button"
                                className="h-8 w-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openAppointmentWithIntent(appointment, {
                                    label: 'labs',
                                    subLabel: 'idexx-labs',
                                  });
                                }}
                              >
                                <MdScience size={15} color="var(--color-neutral-900)" />
                              </button>
                            </GlassTooltip>
                          </div>
                        )}
                        {updatingStatusId === appointment.id && (
                          <div className="relative z-10 mt-1 text-[10px] text-text-secondary">
                            Updating...
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {!hasAppointments && (
                    <div className="rounded-2xl border border-dashed border-card-border bg-white px-3 py-4 text-center text-caption-1 text-text-secondary">
                      No appointments
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AppointmentBoard = React.memo(AppointmentBoardComponent);
export default AppointmentBoard;
