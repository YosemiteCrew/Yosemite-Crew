import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment, OrganisationRoom } from '@yosemite-crew/types';
import {
  allowReschedule,
  canAssignAppointmentRoom,
  getAllowedAppointmentStatusTransitions,
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  isRequestedLikeStatus,
  toStatusLabel,
} from '@/app/lib/appointments';
import {
  assignEncounterUnit,
  changeAppointmentStatus,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
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
import { IoChevronForward } from 'react-icons/io5';

type AppointmentContextMenuProps = {
  appointment: Appointment;
  canEditAppointments: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  menuStyle: React.CSSProperties;
  handleViewAppointment: (appt: Appointment, intent?: AppointmentViewIntent) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  onClose: () => void;
};

type MenuAction = {
  key: string;
  label: string;
  destructive?: boolean;
  submenu?: 'status' | 'room';
  onSelect?: () => void | Promise<void>;
};

type MenuSubmenu = 'status' | 'room' | null;

const MENU_ESTIMATED_WIDTH = 220;
const SUBMENU_ESTIMATED_WIDTH = 200;
const VIEWPORT_MARGIN = 12;
const SUBMENU_HORIZONTAL_GAP = 10;
const SUBMENU_ROW_OFFSET = 4;

type SubmenuPosition = {
  left: number;
  openToLeft: boolean;
  top: number;
};

const getMenuItemClassName = (destructive = false, active = false) =>
  [
    'flex w-full items-center justify-between gap-2 rounded-[12px] px-2.5 py-1.5 text-left font-satoshi text-[16px] font-normal leading-5 tracking-[-0.32px] transition-colors',
    destructive ? 'text-text-error hover:bg-danger-100/72' : 'text-text-primary hover:bg-white/50',
    active ? 'bg-white/58' : 'bg-transparent',
  ].join(' ');

const resolveMenuError = (error: unknown, fallback: string) => {
  const message =
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    (error as Error)?.message;
  return String(message || fallback);
};

const getRoomSavingKey = (roomKey: string) => `room-${roomKey === 'clear-room' ? 'none' : roomKey}`;

const getRoomStatusLabel = (selected: boolean, saving: boolean) => {
  if (selected) return 'Current';
  if (saving) return 'Saving';
  return null;
};

const getFirstUnitIdForRoom = (
  roomId: string,
  roomUnitsById: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitsById'],
  roomUnitIdsByRoomId: ReturnType<typeof useOrganisationRoomStore.getState>['roomUnitIdsByRoomId']
) =>
  (roomUnitIdsByRoomId[roomId] ?? [])
    .map((unitId) => roomUnitsById[unitId])
    .find((unit) => unit?.isActive !== false)?.id;

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
  useLoadRoomsForPrimaryOrg();
  const rooms = useRoomsForPrimaryOrg();
  const roomUnitsById = useOrganisationRoomStore((state) => state.roomUnitsById);
  const roomUnitIdsByRoomId = useOrganisationRoomStore((state) => state.roomUnitIdsByRoomId);
  const initEncounter = useAppointmentWorkspaceStore((state) => state.initEncounter);
  const setRoomUnit = useAppointmentWorkspaceStore((state) => state.setRoomUnit);
  const orgsById = useOrgStore((state) => state.orgsById);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<MenuSubmenu>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<SubmenuPosition>({
    top: Number(menuStyle.top ?? 0),
    left: Number(menuStyle.left ?? 0) + MENU_ESTIMATED_WIDTH + SUBMENU_HORIZONTAL_GAP,
    openToLeft: false,
  });

  const orgType =
    (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';
  const isInpatient = appointment.appointmentKind === 'INPATIENT';
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
    if (!canEnterAppointmentWorkspace(appointment.status)) {
      handleViewAppointment(appointment, intent);
      onClose();
      return;
    }
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
          ? getFirstUnitIdForRoom(room.id, roomUnitsById, roomUnitIdsByRoomId)
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

  const roomOptions = rooms.map((room) => ({
    key: room.id,
    label: room.name,
    selected: room.id === appointment.room?.id,
    onSelect: () => handleRoomChange(room),
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

  const showSubmenu = (submenu: MenuSubmenu, key: string) => {
    setMenuError(null);
    const target = itemRefs.current[key];
    if (target) {
      const rect = target.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();
      const menuLeft = menuRect?.left ?? Number(menuStyle.left ?? 0);
      const menuWidth = menuRect?.width || MENU_ESTIMATED_WIDTH;
      const menuRight = menuLeft + menuWidth;
      const preferredRightLeft = menuRight + SUBMENU_HORIZONTAL_GAP;
      const shouldOpenLeft =
        preferredRightLeft + SUBMENU_ESTIMATED_WIDTH > globalThis.innerWidth - VIEWPORT_MARGIN;
      const nextLeft = shouldOpenLeft
        ? Math.max(VIEWPORT_MARGIN, menuLeft - SUBMENU_ESTIMATED_WIDTH - SUBMENU_HORIZONTAL_GAP)
        : preferredRightLeft;
      const nextTop = Math.max(VIEWPORT_MARGIN, rect.top - SUBMENU_ROW_OFFSET);

      setSubmenuPosition({
        left: nextLeft,
        openToLeft: shouldOpenLeft,
        top: nextTop,
      });
    }
    setActiveSubmenu(submenu);
  };

  useLayoutEffect(() => {
    if (!activeSubmenu) {
      return;
    }

    const submenuRect = submenuRef.current?.getBoundingClientRect();
    const menuRect = menuRef.current?.getBoundingClientRect();
    if (!submenuRect || !menuRect) {
      return;
    }

    const measuredSubmenuWidth = submenuRect.width || SUBMENU_ESTIMATED_WIDTH;
    const measuredSubmenuHeight = submenuRect.height;
    const nextLeft = submenuPosition.openToLeft
      ? Math.max(VIEWPORT_MARGIN, menuRect.left - measuredSubmenuWidth - SUBMENU_HORIZONTAL_GAP)
      : menuRect.right + SUBMENU_HORIZONTAL_GAP;
    const nextTop = Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        submenuPosition.top,
        globalThis.innerHeight - measuredSubmenuHeight - VIEWPORT_MARGIN
      )
    );

    if (
      Math.abs(nextLeft - submenuPosition.left) > 0.5 ||
      Math.abs(nextTop - submenuPosition.top) > 0.5
    ) {
      setSubmenuPosition((currentPosition) => ({
        ...currentPosition,
        left: nextLeft,
        top: nextTop,
      }));
    }
  }, [
    activeSubmenu,
    menuRef,
    submenuPosition.left,
    submenuPosition.openToLeft,
    submenuPosition.top,
  ]);

  return (
    <>
      <div
        ref={menuRef}
        role="menu"
        aria-label="Appointment context actions"
        data-context-menu="true"
        className="fixed z-[1001] overflow-hidden rounded-[22px] border border-white/45 bg-white/36 px-1.5 py-2 shadow-[0_20px_60px_rgba(16,24,40,0.18)] backdrop-blur-2xl"
        style={menuPositionStyle}
      >
        <div className="flex flex-col gap-0.5">
          {actions.map((action, index) => (
            <React.Fragment key={action.key}>
              {index > 0 ? (
                <div className="mx-1 border-t border-white/30" aria-hidden="true" />
              ) : null}
              <button
                ref={(element) => {
                  itemRefs.current[action.key] = element;
                }}
                type="button"
                role="menuitem"
                aria-haspopup={action.submenu ? 'menu' : undefined}
                aria-expanded={action.submenu ? activeSubmenu === action.submenu : undefined}
                className={getMenuItemClassName(
                  action.destructive,
                  activeSubmenu === action.submenu
                )}
                onMouseEnter={() => {
                  if (action.submenu) {
                    showSubmenu(action.submenu, action.key);
                  } else {
                    setActiveSubmenu(null);
                  }
                }}
                onClick={() => {
                  if (action.submenu) {
                    showSubmenu(action.submenu, action.key);
                    return;
                  }
                  void action.onSelect?.();
                }}
              >
                <span className="truncate">{action.label}</span>
                {action.submenu ? (
                  <IoChevronForward size={10} className="shrink-0 opacity-55" />
                ) : null}
              </button>
            </React.Fragment>
          ))}
        </div>
        {menuError ? (
          <div className="mt-0.5 border-t border-white/30 px-1.5 py-1 text-[9px] leading-3.5 text-text-error">
            {menuError}
          </div>
        ) : null}
      </div>

      {activeSubmenu === 'status' && (
        <div
          ref={submenuRef}
          role="menu"
          aria-label="Change appointment status"
          data-context-menu="true"
          className="fixed z-[1002] overflow-hidden rounded-[22px] border border-white/45 bg-white/36 px-1.5 py-2 shadow-[0_20px_60px_rgba(16,24,40,0.18)] backdrop-blur-2xl"
          style={submenuStyle}
        >
          <div className="flex flex-col gap-0.5">
            {statusOptions.map((status, index) => (
              <React.Fragment key={status}>
                {index > 0 ? (
                  <div className="mx-1 border-t border-white/30" aria-hidden="true" />
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className={getMenuItemClassName(false)}
                  onClick={() => {
                    void handleStatusChange(status);
                  }}
                  disabled={savingKey === `status-${status}`}
                >
                  <span className="truncate">{toStatusLabel(status)}</span>
                  {savingKey === `status-${status}` ? (
                    <span className="shrink-0 text-[8px] opacity-60">Saving</span>
                  ) : null}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {activeSubmenu === 'room' && (
        <div
          ref={submenuRef}
          role="menu"
          aria-label="Assign appointment room"
          data-context-menu="true"
          className="fixed z-[1002] overflow-hidden rounded-[22px] border border-white/45 bg-white/36 px-1.5 py-2 shadow-[0_20px_60px_rgba(16,24,40,0.18)] backdrop-blur-2xl"
          style={submenuStyle}
        >
          <div className="flex max-h-[260px] flex-col gap-0.5 overflow-y-auto">
            {roomOptions.length > 0 ? (
              roomOptions.map((room, index) => {
                const isSaving = savingKey === getRoomSavingKey(room.key);
                const roomStatusLabel = getRoomStatusLabel(room.selected, isSaving);

                return (
                  <React.Fragment key={room.key}>
                    {index > 0 ? (
                      <div className="mx-1 border-t border-white/30" aria-hidden="true" />
                    ) : null}
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={room.selected}
                      className={getMenuItemClassName(false, room.selected)}
                      onClick={() => {
                        void room.onSelect();
                      }}
                      disabled={isSaving}
                    >
                      <span className="truncate">{room.label}</span>
                      {roomStatusLabel ? (
                        <span className="shrink-0 text-[8px] opacity-60">{roomStatusLabel}</span>
                      ) : null}
                    </button>
                  </React.Fragment>
                );
              })
            ) : (
              <div className="px-1.5 py-1 text-[9px] leading-3.5 text-text-secondary">
                No rooms available
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const AppointmentContextMenu = React.memo(AppointmentContextMenuComponent);
export default AppointmentContextMenu;
