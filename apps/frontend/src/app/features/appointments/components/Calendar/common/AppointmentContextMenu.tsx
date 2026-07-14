import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment, OrganisationRoom } from '@yosemite-crew/types';
import {
  allowReschedule,
  canAssignAppointmentRoom,
  getAllowedAppointmentStatusTransitions,
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
} from '@/app/lib/appointments';
import {
  assignEncounterUnit,
  changeAppointmentStatus,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { loadRoomsForOrgPrimaryOrg } from '@/app/features/organization/services/roomService';
import { AppointmentStatus } from '@/app/features/appointments/types/appointments';
import { AppointmentViewIntent } from '@/app/features/appointments/types/calendar';
import { useOrgStore } from '@/app/stores/orgStore';
import { buildAppointmentCompanionHistoryHref } from '@/app/lib/companionHistoryRoute';
import {
  buildWorkspaceHrefForIntent,
  canEnterAppointmentWorkspace,
} from '@/app/lib/appointmentWorkspace';
import { useLoadRoomsForPrimaryOrg, useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import {
  getFirstAssignableRoomUnitId,
  toAssignableRoomOptions,
} from '@/app/features/appointments/lib/roomUnitAvailability';
import MenuActionsList from '@/app/features/appointments/components/Calendar/common/MenuActionsList';
import StatusSubmenu from '@/app/features/appointments/components/Calendar/common/StatusSubmenu';
import RoomSubmenu from '@/app/features/appointments/components/Calendar/common/RoomSubmenu';
import {
  MENU_ESTIMATED_WIDTH,
  resolveMenuError,
  SUBMENU_ESTIMATED_WIDTH,
  type MenuAction,
} from '@/app/features/appointments/components/Calendar/common/appointmentContextMenuHelpers';
import { useAppointmentContextSubmenuPosition } from '@/app/features/appointments/components/Calendar/common/useAppointmentContextSubmenuPosition';

type AppointmentContextMenuProps = {
  appointment: Appointment;
  canEditAppointments: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  menuStyle: React.CSSProperties;
  handleViewAppointment: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  onClose: () => void;
};

const AppointmentContextMenuComponent: React.FC<AppointmentContextMenuProps> = ({
  appointment,
  canEditAppointments,
  menuRef,
  menuStyle,
  handleViewAppointment,
  handleRescheduleAppointment,
  onClose,
}) => {
  const router = useRouter();
  useLoadRoomsForPrimaryOrg({ force: true, silent: true });
  const rooms = useRoomsForPrimaryOrg();
  const roomUnitsById = useOrganisationRoomStore((state) => state.roomUnitsById);
  const roomUnitIdsByRoomId = useOrganisationRoomStore((state) => state.roomUnitIdsByRoomId);
  const setRoomUnitOccupied = useOrganisationRoomStore((state) => state.setRoomUnitOccupied);
  const initEncounter = useAppointmentWorkspaceStore((state) => state.initEncounter);
  const setRoomUnit = useAppointmentWorkspaceStore((state) => state.setRoomUnit);
  const orgsById = useOrgStore((state) => state.orgsById);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const { submenuRef, activeSubmenu, setActiveSubmenu, submenuPosition, showSubmenu } =
    useAppointmentContextSubmenuPosition(menuRef, menuStyle);

  const orgType =
    (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';
  const isInpatient = appointment.appointmentKind === 'INPATIENT';
  const encounter = useAppointmentWorkspaceStore((state) =>
    appointment.id ? state.encountersById?.[appointment.id] : undefined
  );
  const currentUnitId = encounter?.unitId;
  const roomIndexes = useMemo(
    () => ({ roomUnitsById, roomUnitIdsByRoomId }),
    [roomUnitIdsByRoomId, roomUnitsById]
  );
  const clinicalNotesLabel = getClinicalNotesLabel(orgType);
  const clinicalNotesIntent = getClinicalNotesIntent(orgType);
  const statusOptions = useMemo(
    () =>
      isRequestedLikeStatus(appointment.status)
        ? []
        : getAllowedAppointmentStatusTransitions(appointment.status),
    [appointment.status]
  );

  const openCompanionHistory = () => {
    router.push(
      buildAppointmentCompanionHistoryHref(
        appointment.id,
        appointment.companion?.id,
        '/appointments'
      )
    );
    onClose();
  };

  const openWorkspace = (intent?: AppointmentViewIntent) => {
    if (!appointment.id) return;
    /* v8 ignore start -- defensive re-check: openWorkspace is only invoked from actions rendered when canEnterAppointmentWorkspace(status) is true, so this branch is unreachable via the menu */
    if (!canEnterAppointmentWorkspace(appointment.status)) {
      handleViewAppointment(appointment, intent);
      onClose();
      return;
    }
    /* v8 ignore stop */
    router.push(buildWorkspaceHrefForIntent(appointment.id, intent));
    onClose();
  };

  const handleStatusChange = async (nextStatus: AppointmentStatus) => {
    try {
      setSavingKey(`status-${nextStatus}`);
      setMenuError(null);
      await changeAppointmentStatus(appointment, nextStatus);
      onClose();
    } catch (error) {
      setMenuError(resolveMenuError(error, 'Unable to update appointment status.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleRoomChange = async (room: OrganisationRoom | null) => {
    try {
      const roomId = room?.id || 'none';
      setSavingKey(`room-${roomId}`);
      setMenuError(null);
      const nextUnitId =
        isInpatient && room
          ? getFirstAssignableRoomUnitId(room.id, roomIndexes, currentUnitId)
          : undefined;
      await updateAppointment({
        ...appointment,
        room: room ? { id: room.id, name: room.name } : undefined,
      });
      if (isInpatient && appointment.id) {
        initEncounter(appointment.id, 'INPATIENT', {
          leadId: appointment.lead?.id,
          leadName: appointment.lead?.name,
        });
        setRoomUnit(appointment.id, room?.id, nextUnitId);
        if (appointment.encounterId && nextUnitId) {
          await assignEncounterUnit({
            encounterId: appointment.encounterId,
            unitId: nextUnitId,
            reason: 'Appointment quick action room assignment',
          });
          setRoomUnitOccupied(currentUnitId, false);
          setRoomUnitOccupied(nextUnitId, true);
          await loadRoomsForOrgPrimaryOrg({ force: true, silent: true });
        }
      }
      onClose();
    } catch (error) {
      setMenuError(resolveMenuError(error, 'Unable to update room.'));
    } finally {
      setSavingKey(null);
    }
  };

  const actions: MenuAction[] = [
    {
      key: 'view-appointment',
      label: 'View appointment',
      onSelect: () => {
        handleViewAppointment(appointment);
        onClose();
      },
    },
    {
      key: 'open-companion-overview',
      label: 'Open companion overview',
      onSelect: openCompanionHistory,
    },
  ];

  if (canEnterAppointmentWorkspace(appointment.status)) {
    actions.push(
      {
        key: 'open-clinical-notes',
        label: clinicalNotesLabel,
        onSelect: () => {
          openWorkspace(clinicalNotesIntent);
        },
      },
      {
        key: 'open-finance-summary',
        label: 'Finance summary',
        onSelect: () => {
          openWorkspace({ label: 'finance', subLabel: 'summary' });
        },
      },
      {
        key: 'open-lab-tests',
        label: 'Lab tests',
        onSelect: () => {
          openWorkspace({ label: 'labs', subLabel: 'idexx-labs' });
        },
      }
    );
  }

  if (canEditAppointments && statusOptions.length > 0) {
    actions.push({
      key: 'change-status',
      label: 'Change status',
      submenu: 'status',
    });
  }

  if (canEditAppointments && allowReschedule(appointment.status)) {
    actions.push({
      key: 'reschedule',
      label: 'Reschedule',
      onSelect: () => {
        handleRescheduleAppointment(appointment);
        onClose();
      },
    });
  }

  if (canEditAppointments && canAssignAppointmentRoom(appointment.status)) {
    actions.push({
      key: 'assign-room',
      label: 'Assign room',
      submenu: 'room',
    });
  }

  const roomOptions = toAssignableRoomOptions(
    rooms,
    roomIndexes,
    appointment.room?.id,
    currentUnitId,
    isInpatient
  ).map((room) => ({
    key: room.value,
    label: room.label,
    selected: room.value === appointment.room?.id,
    /* v8 ignore next -- room.value is always a value from `rooms`, so find never returns undefined; the null fallback is unreachable */
    onSelect: () => handleRoomChange(rooms.find((item) => item.id === room.value) ?? null),
  }));
  if (appointment.room?.id) {
    roomOptions.unshift({
      key: 'clear-room',
      label: 'Clear room',
      selected: false,
      onSelect: () => handleRoomChange(null),
    });
  }

  const submenuStyle = useMemo(() => {
    return {
      left: submenuPosition.left,
      top: submenuPosition.top,
      width: 'max-content',
      maxWidth: `${SUBMENU_ESTIMATED_WIDTH}px`,
    };
  }, [submenuPosition.left, submenuPosition.top]);

  const menuPositionStyle = useMemo(
    () => ({
      top: menuStyle.top,
      left: menuStyle.left,
      width: 'max-content',
      maxWidth: `${MENU_ESTIMATED_WIDTH}px`,
    }),
    [menuStyle.left, menuStyle.top]
  );

  const openSubmenu = (submenu: NonNullable<typeof activeSubmenu>, key: string) => {
    setMenuError(null);
    showSubmenu(submenu, key, itemRefs);
  };

  return (
    <>
      <div
        ref={menuRef}
        role="menu"
        aria-label="Appointment context actions"
        data-context-menu="true"
        className="fixed z-[1001] overflow-hidden rounded-[22px] yc-glass-overlay px-1.5 py-2"
        style={menuPositionStyle}
      >
        <MenuActionsList
          actions={actions}
          activeSubmenu={activeSubmenu}
          itemRefs={itemRefs}
          onHover={(action) => {
            if (action.submenu) {
              openSubmenu(action.submenu, action.key);
            } else {
              setActiveSubmenu(null);
            }
          }}
          onActivate={(action) => {
            if (action.submenu) {
              openSubmenu(action.submenu, action.key);
              return;
            }
            void action.onSelect?.();
          }}
        />
        {menuError ? (
          <div className="mt-0.5 border-t border-[var(--hairline-soft)] px-1.5 py-1 text-[9px] leading-3.5 text-text-error">
            {menuError}
          </div>
        ) : null}
      </div>

      {activeSubmenu === 'status' && (
        <StatusSubmenu
          submenuRef={submenuRef}
          submenuStyle={submenuStyle}
          statusOptions={statusOptions}
          savingKey={savingKey}
          onSelectStatus={(status) => {
            void handleStatusChange(status);
          }}
        />
      )}

      {activeSubmenu === 'room' && (
        <RoomSubmenu
          submenuRef={submenuRef}
          submenuStyle={submenuStyle}
          roomOptions={roomOptions}
          savingKey={savingKey}
        />
      )}
    </>
  );
};

const AppointmentContextMenu = React.memo(AppointmentContextMenuComponent);
export default AppointmentContextMenu;
