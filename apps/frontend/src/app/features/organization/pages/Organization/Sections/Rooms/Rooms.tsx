import React, { useEffect, useState } from 'react';
import {
  IoBedOutline,
  IoBusinessOutline,
  IoCutOutline,
  IoMedkitOutline,
  IoVideocamOutline,
} from 'react-icons/io5';
import AddRoom from '@/app/features/organization/pages/Organization/Sections/Rooms/AddRoom';
import RoomInfo from '@/app/features/organization/pages/Organization/Sections/Rooms/RoomInfo';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { OrganisationRoom } from '@yosemite-crew/types';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';
import { humanize } from '@/app/features/organization/pages/Organization/Sections/orgDisplay';

type ManagedRoom = OrganisationRoom & {
  availability?: {
    isAvailable?: boolean;
  };
};

const roomIcon = (type?: OrganisationRoom['type']): React.ReactNode => {
  switch (type) {
    case 'SURGERY':
    case 'GROOMING':
      return <IoCutOutline size={14} aria-hidden="true" />;
    case 'ICU':
    case 'INPATIENT':
    case 'ISOLATION':
    case 'BOARDING':
      return <IoBedOutline size={14} aria-hidden="true" />;
    case 'IMAGING':
      return <IoVideocamOutline size={14} aria-hidden="true" />;
    case 'WAITING':
    case 'RECEPTION':
      return <IoBusinessOutline size={14} aria-hidden="true" />;
    default:
      return <IoMedkitOutline size={14} aria-hidden="true" />;
  }
};

const daysLabel = (room: ManagedRoom): string | undefined => {
  if (room.availabilityMode === 'ALL_DAY') return 'Every day';
  const days = room.availabilityDays?.filter(Boolean) ?? [];
  if (days.length === 0) return undefined;
  if (days.length >= 7) return 'Every day';
  if (days.length >= 4) {
    return `${humanize(days[0]).slice(0, 3)}–${humanize(days.at(-1)).slice(0, 3)}`;
  }
  return days.map((day) => humanize(day).slice(0, 3)).join(', ');
};

const roomMeta = (room: ManagedRoom): string => {
  const parts: string[] = [];
  const days = daysLabel(room);
  if (days) parts.push(days);
  const capabilities = room.capabilities?.filter(Boolean) ?? [];
  if (capabilities.length) {
    parts.push(capabilities.slice(0, 2).join(', '));
  } else if (room.assignedSpecialiteis?.length) {
    parts.push(
      room.assignedSpecialiteis
        .flatMap((speciality) => (speciality.name ? [speciality.name] : []))
        .slice(0, 2)
        .join(', ')
    );
  }
  return parts.length ? parts.join(' · ') : 'No schedule set';
};

const RoomRow = ({ room, onView }: { room: ManagedRoom; onView: (room: ManagedRoom) => void }) => {
  const typeLabel = humanize(room.type).toLowerCase();
  return (
    <li className="flex items-center gap-[10px] border-t border-[var(--hairline)] px-5! py-[10px]!">
      <button
        type="button"
        aria-label={`View ${room.name || 'room'} details`}
        onClick={() => onView(room)}
        className="flex flex-1 min-w-0 items-center gap-[10px] text-left cursor-pointer"
      >
        <span className="flex size-[30px] flex-none items-center justify-center rounded-[10px] bg-[var(--blue-soft)] text-[var(--blue-text)]">
          {roomIcon(room.type)}
        </span>
        <span className="flex-1 min-w-0 truncate text-[13px] font-bold text-[var(--ink)]">
          {room.name || 'Room'}
          {typeLabel && <span className="font-medium text-[var(--ink-faint)]"> · {typeLabel}</span>}
        </span>
        <span className="hidden truncate text-[11.5px] text-[var(--ink-faint)] sm:block">
          {roomMeta(room)}
        </span>
      </button>
    </li>
  );
};

const Rooms = () => {
  const rooms = useRoomsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditRoom = can(PERMISSIONS.ROOM_EDIT_ANY);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeRoom, setActiveRoom] = useState<OrganisationRoom | null>(rooms[0] ?? null);

  useEffect(() => {
    setActiveRoom((prev) => {
      if (rooms.length === 0) return null;
      if (prev?.id) {
        const updated = rooms.find((s) => s.id === prev.id);
        if (updated) return updated;
      }
      return rooms[0];
    });
  }, [rooms]);

  const handleView = (room: OrganisationRoom) => {
    setActiveRoom(room);
    setViewPopup(true);
  };

  return (
    <PermissionGate allOf={[PERMISSIONS.ROOM_VIEW_ANY]}>
      <section className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
        <div className="flex items-center justify-between gap-3 px-5! pt-4! pb-3!">
          <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-[var(--ink)]">
            Rooms <span className="font-medium text-[var(--ink-faint)]">({rooms.length})</span>
          </h2>
          {canEditRoom && (
            <button
              type="button"
              onClick={() => setAddPopup(true)}
              className="text-[12px] font-semibold text-[var(--blue-text)] hover:text-[var(--nav-active)] transition-colors cursor-pointer"
            >
              + Add room
            </button>
          )}
        </div>
        {rooms.length === 0 ? (
          <div className="border-t border-[var(--hairline)] px-5! py-[18px]! text-[12.5px] text-[var(--ink-faint)]">
            No rooms added yet.
          </div>
        ) : (
          <ul className="flex flex-col">
            {rooms.map((room) => (
              <RoomRow key={room.id} room={room} onView={handleView} />
            ))}
          </ul>
        )}
      </section>
      <AddRoom showModal={addPopup} setShowModal={setAddPopup} />
      {activeRoom && (
        <RoomInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeRoom={activeRoom}
          canEditRoom={canEditRoom}
        />
      )}
    </PermissionGate>
  );
};

export default Rooms;
