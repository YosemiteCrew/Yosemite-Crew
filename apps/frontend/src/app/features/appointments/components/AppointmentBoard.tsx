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
import { allowCalendarDrag } from '@/app/lib/appointments';
import { IoIosCalendar } from 'react-icons/io';
import { IoCardOutline, IoDocumentTextOutline, IoEyeOutline } from 'react-icons/io5';
import { MdMeetingRoom, MdOutlineAutorenew, MdScience } from 'react-icons/md';

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
  setChangeStatusPopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setReschedulePopup?: React.Dispatch<React.SetStateAction<boolean>>;
  setChangeRoomPopup?: React.Dispatch<React.SetStateAction<boolean>>;
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
  setChangeStatusPopup,
  setReschedulePopup,
  setChangeRoomPopup,
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

  const buildDragPreview = (source: HTMLElement): HTMLElement => {
    const preview = source.cloneNode(true) as HTMLElement;
    preview.style.position = 'fixed';
    preview.style.top = '-10000px';
    preview.style.left = '-10000px';
    preview.style.width = `${source.offsetWidth}px`;
    preview.style.maxWidth = `${source.offsetWidth}px`;
    preview.style.pointerEvents = 'none';
    preview.style.borderRadius = '16px';
    preview.style.overflow = 'hidden';
    preview.style.boxShadow = 'none';
    preview.style.background = '#fff';
    preview.style.transform = 'scale(0.94)';
    preview.style.transformOrigin = 'top left';
    preview.style.opacity = '1';
    preview.style.zIndex = '99999';
    document.body.appendChild(preview);
    return preview;
  };

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

  const openAppointmentWithIntent = (appointment: Appointment, intent?: AppointmentViewIntent) => {
    setActiveAppointment?.(appointment);
    setViewIntent?.(intent ?? null);
    setViewPopup?.(true);
  };

  const openChangeStatus = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
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

  const getEdgeScrollDelta = (clientPosition: number, start: number, end: number) => {
    const EDGE_PX = 56;
    const SPEED_PX = 24;
    if (clientPosition - start < EDGE_PX) return -SPEED_PX;
    if (end - clientPosition < EDGE_PX) return SPEED_PX;
    return 0;
  };

  const canScrollVertically = (el: HTMLElement, delta: number) => {
    if (delta < 0) return el.scrollTop > 0;
    if (delta > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    return false;
  };

  const canScrollHorizontally = (el: HTMLElement, delta: number) => {
    if (delta < 0) return el.scrollLeft > 0;
    if (delta > 0) return el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    return false;
  };

  const autoScrollBoardOnDrag = (
    event: React.DragEvent<HTMLElement>,
    innerScrollable?: HTMLElement | null
  ) => {
    const innerRect = innerScrollable?.getBoundingClientRect();
    const deltaInnerY = innerRect
      ? getEdgeScrollDelta(event.clientY, innerRect.top, innerRect.bottom)
      : 0;
    if (innerScrollable && deltaInnerY !== 0 && canScrollVertically(innerScrollable, deltaInnerY)) {
      innerScrollable.scrollBy({ top: deltaInnerY });
      return;
    }

    const boardRoot = (event.currentTarget.closest('[data-board-scroll-root="true"]') ||
      event.currentTarget) as HTMLElement;
    const boardRect = boardRoot.getBoundingClientRect();
    const deltaBoardX = getEdgeScrollDelta(event.clientX, boardRect.left, boardRect.right);
    if (deltaBoardX !== 0 && canScrollHorizontally(boardRoot, deltaBoardX)) {
      boardRoot.scrollBy({ left: deltaBoardX });
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
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-3"
        data-calendar-scroll="true"
        data-board-scroll-root="true"
        onDragOver={(event) => {
          if (!draggedAppointmentId || !canEditAppointments) return;
          autoScrollBoardOnDrag(event);
        }}
      >
        <div className="h-full min-w-max flex items-stretch gap-3">
          {BOARD_COLUMNS.map((column) =>
            (() => {
              const columnAppointments = groupedAppointments[column.key];
              const hasAppointments = columnAppointments.length > 0;
              const style = getStatusStyle(column.key);
              return (
                <div
                  key={column.key}
                  className="w-[320px] min-w-[320px] max-w-[320px] h-full rounded-2xl border border-card-border bg-white overflow-hidden flex flex-col min-h-0"
                  onDragOver={(event) => {
                    if (!draggedAppointmentId || !canEditAppointments) return;
                    event.preventDefault();
                    autoScrollBoardOnDrag(event);
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
                    className="flex-1 min-h-0 h-0 flex flex-col gap-2 p-3 pb-4 bg-white overflow-y-auto"
                    data-calendar-scroll="true"
                    onDragOver={(event) => {
                      if (!draggedAppointmentId || !canEditAppointments) return;
                      event.preventDefault();
                      autoScrollBoardOnDrag(event, event.currentTarget);
                    }}
                  >
                    {columnAppointments.map((appointment) => (
                      <button
                        key={appointment.id}
                        type="button"
                        className={`w-full min-h-[142px] shrink-0 rounded-2xl! overflow-hidden border border-card-border bg-white px-4 py-3 text-left transition-colors flex flex-col items-stretch justify-start ${
                          draggedAppointmentId === (appointment.id ?? null)
                            ? 'opacity-60 shadow-none'
                            : 'hover:border-input-border-active! hover:bg-card-hover!'
                        }`}
                        onClick={() => openAppointment(appointment)}
                        draggable={canEditAppointments}
                        onDragStart={(event) => {
                          setDraggedAppointmentId(appointment.id ?? null);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', appointment.id ?? '');
                          const preview = buildDragPreview(event.currentTarget);
                          event.dataTransfer.setDragImage(preview, 24, 24);
                          requestAnimationFrame(() => {
                            preview.remove();
                          });
                        }}
                        onDragEnd={() => setDraggedAppointmentId(null)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-caption-1 font-semibold text-text-primary">
                              <div className="break-words">{appointment.companion.name}</div>
                              <div className="break-words text-[10px] font-normal text-text-secondary">
                                Owner: {appointment.companion.parent?.name || '-'}
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
                        <div className="pt-1 pb-1 border-t border-card-border/60 flex items-center justify-between gap-2">
                          <div className="text-[10px] text-text-secondary break-words">
                            Lead: {appointment.lead?.name || '-'}
                          </div>
                          {(() => {
                            const payment = getAppointmentPaymentDisplay(
                              appointment,
                              invoicesByAppointmentId
                            );
                            return (
                              <div
                                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium"
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
                        {appointment.status !== 'REQUESTED' &&
                          appointment.status !== 'NO_PAYMENT' && (
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap max-w-[184px]">
                              <GlassTooltip content="View appointment" side="bottom">
                                <button
                                  type="button"
                                  className="h-8 w-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openAppointmentWithIntent(appointment);
                                  }}
                                >
                                  <IoEyeOutline size={16} color="#302F2E" />
                                </button>
                              </GlassTooltip>
                              {canEditAppointments && (
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
                                    <MdOutlineAutorenew size={15} color="#302F2E" />
                                  </button>
                                </GlassTooltip>
                              )}
                              {canEditAppointments &&
                                allowCalendarDrag(appointment.status as any) && (
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
                                      <IoIosCalendar size={15} color="#302F2E" />
                                    </button>
                                  </GlassTooltip>
                                )}
                              {canEditAppointments && (
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
                                    <MdMeetingRoom size={15} color="#302F2E" />
                                  </button>
                                </GlassTooltip>
                              )}
                              <GlassTooltip content="SOAP / notes" side="bottom">
                                <button
                                  type="button"
                                  className="h-8 w-8 rounded-full! border border-black-text! bg-white flex items-center justify-center"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openAppointmentWithIntent(appointment, {
                                      label: 'prescription',
                                      subLabel: 'subjective',
                                    });
                                  }}
                                >
                                  <IoDocumentTextOutline size={15} color="#302F2E" />
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
                                  <IoCardOutline size={15} color="#302F2E" />
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
                                  <MdScience size={15} color="#302F2E" />
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
    </div>
  );
};

export default AppointmentBoard;
