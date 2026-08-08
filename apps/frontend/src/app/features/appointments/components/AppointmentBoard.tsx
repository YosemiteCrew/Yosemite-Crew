import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoAdd } from 'react-icons/io5';
import { useBoardDragScroll } from '@/app/hooks/useBoardDragScroll';
import { useScrollBoundaryWheel } from '@/app/hooks/useScrollBoundaryWheel';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import { buildDragPreview } from '@/app/lib/buildDragPreview';
import { attachBoardColumnDnDListeners } from '@/app/ui/board/boardShared';
import { Appointment } from '@yosemite-crew/types';
import { getStatusStyle } from '@/app/config/statusConfig';
import { changeAppointmentStatus } from '@/app/features/appointments/services/appointmentService';
import { isOnPreferredTimeZoneCalendarDay } from '@/app/lib/timezone';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useAuthStore } from '@/app/stores/authStore';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { createInvoiceByAppointmentId } from '@/app/lib/paymentStatus';
import {
  canTransitionAppointmentStatus,
  getPreferredNextAppointmentStatus,
  getInvalidAppointmentStatusTransitionMessage,
} from '@/app/lib/appointments';
import { useOrgStore } from '@/app/stores/orgStore';
import { useNotify } from '@/app/hooks/useNotify';
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import {
  buildWorkspaceHrefForIntent,
  canEnterAppointmentWorkspace,
} from '@/app/lib/appointmentWorkspace';
import { startRouteLoader } from '@/app/lib/routeLoader';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import AppointmentBoardToolbar from '@/app/features/appointments/components/AppointmentBoardToolbar';
import AppointmentBoardCard from '@/app/features/appointments/components/AppointmentBoardCard';
import {
  BOARD_COLUMNS,
  BoardStatus,
  normalizeStatus,
} from '@/app/features/appointments/components/appointmentBoardHelpers';

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

const normalizeId = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .split('/')
    .pop()
    ?.toLowerCase() ?? '';

/**
 * Wire native dragover/drop listeners onto the board root and each column's drop
 * and scroll elements so cards can be dragged between status columns with
 * auto-scroll near the edges. Native listeners (not React props) because the
 * refs are populated after render and the scroll containers are nested.
 */
const useBoardDropTargets = ({
  boardRootRef,
  columnDropRefs,
  columnScrollRefs,
  draggedAppointmentId,
  canEditAppointments,
  autoScrollBoardOnDrag,
  onDropRef,
}: {
  boardRootRef: React.RefObject<HTMLDivElement | null>;
  columnDropRefs: React.RefObject<Partial<Record<BoardStatus, HTMLDivElement | null>>>;
  columnScrollRefs: React.RefObject<Partial<Record<BoardStatus, HTMLDivElement | null>>>;
  draggedAppointmentId: string | null;
  canEditAppointments: boolean;
  autoScrollBoardOnDrag: (event: React.DragEvent<HTMLElement>, scrollElement?: HTMLElement) => void;
  onDropRef: React.RefObject<(appointmentId: string, nextStatus: BoardStatus) => void>;
}) => {
  useEffect(() => {
    const boardRoot = boardRootRef.current;
    if (!boardRoot) return;

    const handleBoardDragOver = (event: DragEvent) => {
      if (!draggedAppointmentId || !canEditAppointments) return;
      autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>);
    };

    boardRoot.addEventListener('dragover', handleBoardDragOver);
    return () => boardRoot.removeEventListener('dragover', handleBoardDragOver);
  }, [autoScrollBoardOnDrag, boardRootRef, canEditAppointments, draggedAppointmentId]);

  useEffect(() => {
    const cleanups = BOARD_COLUMNS.flatMap((column) => {
      const dropElement = columnDropRefs.current?.[column.key];
      const scrollElement = columnScrollRefs.current?.[column.key];
      if (!dropElement || !scrollElement) return [];

      return attachBoardColumnDnDListeners({
        dropElement,
        scrollElement,
        isDragActive: () => !!draggedAppointmentId && canEditAppointments,
        onDrop: () => {
          /* v8 ignore next -- defensive: onDrop only fires mid-drag with a live drop handler */
          if (draggedAppointmentId) onDropRef.current?.(draggedAppointmentId, column.key);
        },
        autoScrollBoardOnDrag,
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    autoScrollBoardOnDrag,
    canEditAppointments,
    columnDropRefs,
    columnScrollRefs,
    draggedAppointmentId,
    onDropRef,
  ]);
};

const BoardColumn = ({
  column,
  appointments,
  setDropRef,
  setScrollRef,
  onWheelBoundary,
  renderCard,
  canEditAppointments,
  onAddAppointment,
}: {
  column: (typeof BOARD_COLUMNS)[number];
  appointments: Appointment[];
  setDropRef: (element: HTMLDivElement | null) => void;
  setScrollRef: (element: HTMLDivElement | null) => void;
  onWheelBoundary: React.WheelEventHandler<HTMLElement>;
  renderCard: (appointment: Appointment) => React.ReactNode;
  canEditAppointments: boolean;
  onAddAppointment?: () => void;
}) => {
  const style = getStatusStyle(column.key);
  return (
    <div
      ref={setDropRef}
      // Foundations: below tablet the columns become 300px snap-scroll panes;
      // from md up they hold the 320px board width.
      className="w-[300px] min-w-[300px] max-w-[300px] md:w-[320px] md:min-w-[320px] md:max-w-[320px] h-full snap-start rounded-2xl bg-[var(--inset)] overflow-hidden flex flex-col min-h-0"
    >
      <div className="px-3.5 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: style.borderColor }}
            />
            <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
              {column.label}
            </div>
          </div>
          <div className="text-[11.5px] font-bold text-[var(--ink-faint)]">
            {appointments.length}
          </div>
        </div>
      </div>
      <div
        ref={setScrollRef}
        className="flex-1 min-h-0 h-0 flex flex-col gap-2.5 px-2.5 pb-3 overflow-y-auto"
        onWheel={onWheelBoundary}
        data-calendar-scroll="true"
      >
        {appointments.map(renderCard)}
        {appointments.length === 0 && (
          <div className="rounded-[13px] border border-dashed border-card-border bg-neutral-0 px-3 py-4 text-center text-caption-1 text-text-secondary">
            No appointments
          </div>
        )}
        {canEditAppointments && (
          <button
            type="button"
            aria-label={`Add appointment to ${column.label}`}
            onClick={onAddAppointment}
            className="mt-auto flex items-center justify-center gap-[5px] rounded-[11px] border border-dashed border-[var(--divider)] p-[9px] text-[11.5px] font-semibold text-text-tertiary transition-colors hover:border-input-border-active hover:text-text-primary"
          >
            <IoAdd size={13} aria-hidden="true" />
            Add
          </button>
        )}
      </div>
    </div>
  );
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
  const encountersById = useAppointmentWorkspaceStore((s) => s.encountersById);
  const roomUnitsById = useOrganisationRoomStore((s) => s.roomUnitsById);
  const team = useTeamForPrimaryOrg();
  const authUserId = useAuthStore((s) => s.attributes?.sub || s.attributes?.email || '');
  const [draggedAppointmentId, setDraggedAppointmentId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const boardRootRef = useRef<HTMLDivElement | null>(null);
  const columnDropRefs = useRef<Partial<Record<BoardStatus, HTMLDivElement | null>>>({});
  const columnScrollRefs = useRef<Partial<Record<BoardStatus, HTMLDivElement | null>>>({});
  const invoices = useInvoicesForPrimaryOrg();
  const invoicesByAppointmentId = useMemo(() => createInvoiceByAppointmentId(invoices), [invoices]);

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
        .filter(
          (appointment) =>
            isOnPreferredTimeZoneCalendarDay(appointment.startTime, currentDate) &&
            (!showMineOnly || normalizeId(appointment.lead?.id) === currentUserLeadId)
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
    if (setViewPopup) {
      setViewPopup(true);
      return;
    }
    setDetailPopup?.(true);
  };

  const openAppointmentWorkspace = (appointment: Appointment, intent?: AppointmentViewIntent) => {
    if (!appointment.id) return;
    if (!canEnterAppointmentWorkspace(appointment.status)) {
      openAppointment(appointment);
      return;
    }
    startRouteLoader();
    router.push(buildWorkspaceHrefForIntent(appointment.id, intent));
  };

  const openAppointmentHistory = (appointment: Appointment) => {
    startRouteLoader();
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
  const onWheelBoundary = useScrollBoundaryWheel();

  const moveToStatus = useCallback(
    async (appointmentId: string, nextStatus: BoardStatus) => {
      const appointment = todayAppointments.find((item) => item.id === appointmentId);
      /* v8 ignore next -- defensive: a dragged card id always resolves to a listed appointment */
      if (!appointment?.id) return;
      const currentStatus = normalizeStatus(appointment.status);
      if (currentStatus === nextStatus) return;
      /* v8 ignore next -- unreachable: drops are gated by canEditAppointments via isDragActive */
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

  const handleDroppedAppointmentStatusRef = useRef(handleDroppedAppointmentStatus);
  handleDroppedAppointmentStatusRef.current = handleDroppedAppointmentStatus;

  useBoardDropTargets({
    boardRootRef,
    columnDropRefs,
    columnScrollRefs,
    draggedAppointmentId,
    canEditAppointments,
    autoScrollBoardOnDrag,
    onDropRef: handleDroppedAppointmentStatusRef,
  });

  return (
    <div className="h-full min-h-0 rounded-2xl border border-card-border bg-neutral-0 overflow-hidden flex flex-col">
      <AppointmentBoardToolbar
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        onWheelHorizontal={onWheelHorizontal}
        emergency={{
          active: isEmergencyActive,
          color: emergencyColor,
          present: hasEmergency,
          onToggle: toggleEmergencyFilter,
        }}
        permissions={{ editAppointments: canEditAppointments }}
        onAddAppointment={onAddAppointment}
        scope={{ mineOnly: showMineOnly, onMineOnlyChange: setShowMineOnly }}
      />
      <div
        ref={boardRootRef}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-3 scrollbar-x-float snap-x snap-mandatory md:snap-none"
        data-calendar-scroll="true"
        data-board-scroll-root="true"
        onWheel={onWheelHorizontal}
      >
        <div className="h-full min-w-max flex items-stretch gap-3">
          {BOARD_COLUMNS.map((column) => (
            <BoardColumn
              key={column.key}
              column={column}
              appointments={groupedAppointments[column.key]}
              setDropRef={(element) => {
                columnDropRefs.current[column.key] = element;
              }}
              setScrollRef={(element) => {
                columnScrollRefs.current[column.key] = element;
              }}
              onWheelBoundary={onWheelBoundary}
              canEditAppointments={canEditAppointments}
              onAddAppointment={onAddAppointment}
              renderCard={(appointment) => (
                <AppointmentBoardCard
                  key={appointment.id}
                  appointment={appointment}
                  encountersById={encountersById}
                  roomUnitsById={roomUnitsById}
                  canEditAppointments={canEditAppointments}
                  draggedAppointmentId={draggedAppointmentId}
                  invoicesByAppointmentId={invoicesByAppointmentId}
                  orgsById={orgsById}
                  handleAppointmentDragStart={handleAppointmentDragStart}
                  setDraggedAppointmentId={setDraggedAppointmentId}
                  openAppointment={openAppointment}
                  openAppointmentHistory={openAppointmentHistory}
                  openChangeStatus={openChangeStatus}
                  openReschedule={openReschedule}
                  openChangeRoom={openChangeRoom}
                  openAppointmentWorkspace={openAppointmentWorkspace}
                  updatingStatusId={updatingStatusId}
                />
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const AppointmentBoard = React.memo(AppointmentBoardComponent);
export default AppointmentBoard;
