import RoomTable from '@/app/ui/tables/RoomTable';
import React, { useEffect, useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import AddRoom from '@/app/features/organization/pages/Organization/Sections/Rooms/AddRoom';
import RoomInfo from '@/app/features/organization/pages/Organization/Sections/Rooms/RoomInfo';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { OrganisationRoom } from '@yosemite-crew/types';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';
import { toggleRoomAvailability } from '@/app/features/organization/services/roomService';
import { useNotify } from '@/app/hooks/useNotify';

type ManagedRoom = OrganisationRoom & {
  availability?: {
    isAvailable?: boolean;
  };
};

const Rooms = () => {
  const rooms = useRoomsForPrimaryOrg();
  const { notify } = useNotify();
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

  const handleEditRoom = (room: ManagedRoom) => {
    setActiveRoom(room);
    setViewPopup(true);
  };

  const handleToggleAvailability = async (room: ManagedRoom, isAvailable: boolean) => {
    if (!canEditRoom) return;
    try {
      await toggleRoomAvailability(room, isAvailable);
      notify('success', {
        title: isAvailable ? 'Room available' : 'Room unavailable',
        text: `${room.name} availability has been updated.`,
      });
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to update room',
        text: 'Failed to update room availability. Please try again.',
      });
    }
  };

  return (
    <PermissionGate allOf={[PERMISSIONS.ROOM_VIEW_ANY]}>
      <section className="bg-[var(--screen)] border border-[var(--hairline)] rounded-[18px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5! pt-4! pb-3!">
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--ink)]">
            Rooms <span className="font-medium text-[var(--ink-faint)]">({rooms.length})</span>
          </h2>
          {canEditRoom && (
            <button
              type="button"
              onClick={() => setAddPopup(true)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--blue-text)] hover:text-[var(--nav-active)] transition-colors cursor-pointer"
            >
              <IoAddOutline size={15} aria-hidden="true" />
              Add room
            </button>
          )}
        </div>
        <div className="border-t border-[var(--hairline)]">
          <RoomTable
            filteredList={rooms}
            setActive={setActiveRoom}
            setView={setViewPopup}
            onEdit={handleEditRoom}
            onToggleAvailability={handleToggleAvailability}
            canEditRoom={canEditRoom}
          />
        </div>
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
