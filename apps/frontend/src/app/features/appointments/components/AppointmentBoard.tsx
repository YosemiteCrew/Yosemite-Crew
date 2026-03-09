import React, { useMemo, useState } from 'react';
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
import { IoAdd } from 'react-icons/io5';
import Image from 'next/image';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { FaCheckCircle } from 'react-icons/fa';
import { IoIosCloseCircle } from 'react-icons/io';

type BoardStatus =
  | 'REQUESTED'
  | 'UPCOMING'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

const BoardScopeToggle = ({
  showMineOnly,
  disabled,
  onChange,
}: {
  showMineOnly: boolean;
  disabled?: boolean;
  onChange: (nextShowMineOnly: boolean) => void;
}) => {
  const isAllAppointments = !showMineOnly;
  const sliderClass = isAllAppointments
    ? 'translate-x-0 bg-[#247AED] border-[#247AED]'
    : 'translate-x-full bg-[#D28F9A] border-[#D28F9A]';
  const allTextClass = isAllAppointments ? 'text-neutral-0' : 'text-text-secondary';
  const mineTextClass = isAllAppointments ? 'text-text-secondary' : 'text-neutral-0';

  return (
    <div
      className={`relative inline-flex items-center h-9 w-[320px] max-w-full rounded-[999px]! border border-card-border bg-white overflow-hidden ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      <div
        aria-hidden
        className={`absolute top-0 bottom-0 left-0 w-1/2 rounded-[999px]! border-0 transition-all duration-300 ease-in-out ${sliderClass}`}
      />
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={`relative z-10 w-1/2 h-full text-body-4 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${allTextClass}`}
      >
        All appointments
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={`relative z-10 w-1/2 h-full text-body-4 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${mineTextClass}`}
      >
        My appointments
      </button>
    </div>
  );
};

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
  if (!status) return null;
  if (status === 'NO_PAYMENT') return 'REQUESTED';
  if (
    status === 'REQUESTED' ||
    status === 'UPCOMING' ||
    status === 'CHECKED_IN' ||
    status === 'IN_PROGRESS' ||
    status === 'COMPLETED' ||
    status === 'CANCELLED' ||
    status === 'NO_SHOW'
  ) {
    return status;
  }
  return null;
};

type AppointmentBoardProps = {
  appointments: Appointment[];
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  canEditAppointments: boolean;
  setActiveAppointment?: (appointment: Appointment) => void;
  setViewPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setViewIntent?: (intent: AppointmentViewIntent | null) => void;
  onAddAppointment?: () => void;
};

const AppointmentBoard = ({
  appointments,
  currentDate,
  setCurrentDate,
  canEditAppointments,
  setActiveAppointment,
  setViewPopup,
  setViewIntent,
  onAddAppointment,
}: AppointmentBoardProps) => {
  const team = useTeamForPrimaryOrg();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );
  const [draggedAppointmentId, setDraggedAppointmentId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);
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

  const openAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setViewIntent?.(null);
    setViewPopup?.(true);
  };

  const getEdgeScrollDelta = (clientY: number, rect: DOMRect) => {
    const EDGE_PX = 56;
    const SPEED_PX = 24;
    if (clientY - rect.top < EDGE_PX) return -SPEED_PX;
    if (rect.bottom - clientY < EDGE_PX) return SPEED_PX;
    return 0;
  };

  const canScrollInDirection = (el: HTMLElement, delta: number) => {
    if (delta < 0) return el.scrollTop > 0;
    if (delta > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    return false;
  };

  const autoScrollBoardOnDrag = (
    event: React.DragEvent<HTMLElement>,
    innerScrollable?: HTMLElement | null
  ) => {
    const deltaInner = innerScrollable
      ? getEdgeScrollDelta(event.clientY, innerScrollable.getBoundingClientRect())
      : 0;
    if (innerScrollable && deltaInner !== 0 && canScrollInDirection(innerScrollable, deltaInner)) {
      innerScrollable.scrollBy({ top: deltaInner });
      return;
    }

    const boardRoot = (event.currentTarget.closest('[data-board-scroll-root="true"]') ||
      event.currentTarget) as HTMLElement;
    const deltaBoard = getEdgeScrollDelta(event.clientY, boardRoot.getBoundingClientRect());
    if (deltaBoard !== 0 && canScrollInDirection(boardRoot, deltaBoard)) {
      boardRoot.scrollBy({ top: deltaBoard });
    }
  };

  const moveToStatus = async (appointmentId: string, nextStatus: BoardStatus) => {
    const appointment = todayAppointments.find((item) => item.id === appointmentId);
    if (!appointment || !appointment.id) return;
    const currentStatus = normalizeStatus(appointment.status);
    if (currentStatus === nextStatus) return;
    if (!canEditAppointments) return;

    try {
      setUpdatingStatusId(appointment.id);
      await changeAppointmentStatus(appointment, nextStatus);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="h-full min-h-0 rounded-2xl border border-grey-light bg-white overflow-hidden flex flex-col">
      <div className="border-b border-card-border bg-white px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-body-4-emphasis text-text-primary flex-1 min-w-[220px]">
            <Back
              onClick={() =>
                setCurrentDate((prev) => {
                  const next = new Date(prev);
                  next.setDate(next.getDate() - 1);
                  return next;
                })
              }
            />
            <div>
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
          <div className="relative z-20 flex items-center justify-end gap-2 flex-1 min-w-[420px]">
            {canEditAppointments && (
              <GlassTooltip content="Add appointment" side="bottom">
                <button
                  type="button"
                  title="Add appointment"
                  aria-label="Add appointment"
                  onClick={onAddAppointment}
                  className="rounded-2xl! border! border-input-border-default! px-[13px] py-[13px] transition-all duration-300 ease-in-out hover:bg-card-bg"
                >
                  <IoAdd size={20} color="#302f2e" />
                </button>
              </GlassTooltip>
            )}
            <GlassTooltip content="Select date" side="bottom">
              <Datepicker
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                placeholder="Select Date"
              />
            </GlassTooltip>
            <BoardScopeToggle showMineOnly={showMineOnly} onChange={setShowMineOnly} />
          </div>
        </div>
      </div>
      <div
        className="flex-1 min-h-0 overflow-y-auto p-3 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-min"
        data-calendar-scroll="true"
        data-board-scroll-root="true"
        onDragOver={(event) => {
          if (!draggedAppointmentId || !canEditAppointments) return;
          autoScrollBoardOnDrag(event);
        }}
      >
        {BOARD_COLUMNS.map((column) =>
          (() => {
            const columnAppointments = groupedAppointments[column.key];
            const hasAppointments = columnAppointments.length > 0;
            const style = getStatusStyle(column.key);
            return (
              <div
                key={column.key}
                className="w-full rounded-2xl border border-card-border bg-white overflow-hidden flex flex-col min-h-0"
                onDragOver={(event) => {
                  if (!draggedAppointmentId || !canEditAppointments) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!draggedAppointmentId || !canEditAppointments) return;
                  event.preventDefault();
                  void moveToStatus(draggedAppointmentId, column.key);
                  setDraggedAppointmentId(null);
                }}
              >
                <div
                  className="rounded-t-2xl border-b border-card-border px-3 py-2"
                  style={{ backgroundColor: style.backgroundColor }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-body-4-emphasis text-text-primary">{column.label}</div>
                    <div className="text-caption-1 rounded-full px-2 py-0.5 bg-white text-black-text">
                      {columnAppointments.length}
                    </div>
                  </div>
                </div>
                <div
                  className={`flex flex-col gap-2 p-3 bg-white min-h-0 ${
                    hasAppointments
                      ? 'min-h-[280px] max-h-[calc(100vh-240px)] overflow-y-auto'
                      : 'min-h-[110px] max-h-[150px] overflow-y-hidden'
                  }`}
                  data-calendar-scroll="true"
                  onDragOver={(event) => {
                    if (!draggedAppointmentId || !canEditAppointments) return;
                    autoScrollBoardOnDrag(event, event.currentTarget);
                  }}
                >
                  {columnAppointments.map((appointment) => (
                    <button
                      key={appointment.id}
                      type="button"
                      className="w-full rounded-2xl! overflow-hidden border border-card-border bg-white px-3 py-2 text-left hover:shadow-[0_0_8px_0_rgba(0,0,0,0.1)]"
                      onClick={() => openAppointment(appointment)}
                      draggable={canEditAppointments}
                      onDragStart={() => setDraggedAppointmentId(appointment.id ?? null)}
                      onDragEnd={() => setDraggedAppointmentId(null)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-caption-1 font-semibold text-text-primary">
                            <div className="truncate">{appointment.companion.name}</div>
                            <div className="truncate text-[10px] font-normal text-text-secondary">
                              Owner: {appointment.companion.parent?.name || '-'}
                            </div>
                            <div className="truncate text-[10px] font-normal text-text-secondary">
                              Reason: {appointment.concern || '-'}
                            </div>
                            <div className="truncate text-[10px] font-normal text-text-secondary">
                              Room: {appointment.room?.name || '-'}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Image
                            src={getSafeImageUrl(
                              '',
                              appointment.companion.species.toLowerCase() as ImageType
                            )}
                            height={24}
                            width={24}
                            className="rounded-full border border-card-border bg-white"
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
                      <div className="mt-2 flex items-center justify-between">
                        <div className="truncate text-[10px] text-text-secondary">
                          Lead: {appointment.lead?.name || '-'}
                        </div>
                        {(() => {
                          const payment = getAppointmentPaymentDisplay(
                            appointment,
                            invoicesByAppointmentId
                          );
                          return (
                            <div
                              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: payment.badgeBackgroundColor,
                                color: payment.badgeTextColor,
                              }}
                            >
                              {payment.label}
                            </div>
                          );
                        })()}
                      </div>
                      {(appointment.status === 'REQUESTED' ||
                        appointment.status === 'NO_PAYMENT') && (
                        <div className="mt-2 flex items-center justify-end gap-1">
                          <GlassTooltip content="Accept request" side="bottom">
                            <button
                              type="button"
                              className="h-7 w-7 rounded-full! bg-[#E6F4EF] border border-[#d3eadf] flex items-center justify-center"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void acceptAppointment(appointment);
                              }}
                            >
                              <FaCheckCircle size={14} color="#54B492" />
                            </button>
                          </GlassTooltip>
                          <GlassTooltip content="Decline request" side="bottom">
                            <button
                              type="button"
                              className="h-7 w-7 rounded-full! bg-[#FDEBEA] border border-[#f5d0ce] flex items-center justify-center"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void rejectAppointment(appointment);
                              }}
                            >
                              <IoIosCloseCircle size={16} color="#EA3729" />
                            </button>
                          </GlassTooltip>
                        </div>
                      )}
                      {updatingStatusId === appointment.id && (
                        <div className="mt-1 text-[10px] text-text-secondary">Updating...</div>
                      )}
                    </button>
                  ))}
                  {!hasAppointments && (
                    <div className="rounded-2xl border border-dashed border-card-border bg-white px-3 py-4 text-center text-caption-1 text-text-secondary">
                      No appointments
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};

export default AppointmentBoard;
