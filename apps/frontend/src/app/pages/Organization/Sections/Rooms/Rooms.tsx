import AccordionButton from "@/app/components/Accordion/AccordionButton";
import RoomTable from "@/app/components/DataTable/RoomTable";
import React, { useEffect, useState } from "react";
import AddRoom from "./AddRoom";
import RoomInfo from "./RoomInfo";
import { useRoomsForPrimaryOrg } from "@/app/hooks/useRooms";
import { OrganisationRoom } from "@yosemite-crew/types";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import { usePermissions } from "@/app/hooks/usePermissions";

const Rooms = () => {
  const rooms = useRoomsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditRoom = can(PERMISSIONS.ROOM_EDIT_ANY);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeRoom, setActiveRoom] = useState<OrganisationRoom | null>(
    rooms[0] ?? null
  );

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

  return (
    <PermissionGate allOf={[PERMISSIONS.ROOM_VIEW_ANY]}>
      <AccordionButton
        title="Rooms"
        buttonTitle="Add"
        buttonClick={setAddPopup}
        showButton={canEditRoom}
      >
        <RoomTable
          filteredList={rooms}
          setActive={setActiveRoom}
          setView={setViewPopup}
        />
      </AccordionButton>
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
