import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBoardDragScroll } from '@/app/hooks/useBoardDragScroll';
import { useScrollBoundaryWheel } from '@/app/hooks/useScrollBoundaryWheel';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';
import { buildDragPreview } from '@/app/lib/buildDragPreview';
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

  const handleDroppedAppointmentStatusRef = useRef(handleDroppedAppointmentStatus);
  handleDroppedAppointmentStatusRef.current = handleDroppedAppointmentStatus;

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
        handleDroppedAppointmentStatusRef.current(draggedAppointmentId, column.key);
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
  }, [autoScrollBoardOnDrag, canEditAppointments, draggedAppointmentId]);

  return (
    <div className="h-full min-h-0 rounded-2xl border border-grey-light bg-white overflow-hidden flex flex-col">
      <AppointmentBoardToolbar
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        onWheelHorizontal={onWheelHorizontal}
        toggleEmergencyFilter={toggleEmergencyFilter}
        isEmergencyActive={isEmergencyActive}
        emergencyColor={emergencyColor}
        hasEmergency={hasEmergency}
        canEditAppointments={canEditAppointments}
        onAddAppointment={onAddAppointment}
        showMineOnly={showMineOnly}
        setShowMineOnly={setShowMineOnly}
      />
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
                  onWheel={onWheelBoundary}
                  data-calendar-scroll="true"
                >
                  {columnAppointments.map((appointment) => (
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
                  ))}
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
