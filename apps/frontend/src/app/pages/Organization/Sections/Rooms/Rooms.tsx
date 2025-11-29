import AccordionButton from "@/app/components/Accordion/AccordionButton";
import RoomTable from "@/app/components/DataTable/RoomTable";
import React, { useEffect, useState } from "react";
import { demoRooms } from "../../demo";
import AddRoom from "./AddRoom";
import RoomInfo from "./RoomInfo";

const Rooms = () => {
  const [rooms] = useState(demoRooms);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeRoom, setActiveRoom] = useState<any>(demoRooms[0] ?? null);

  useEffect(() => {
    if (rooms.length > 0) {
      setActiveRoom(rooms[0]);
    } else {
      setActiveRoom(null);
    }
  }, [rooms]);

  return (
    <>
      <AccordionButton
        title="Rooms"
        buttonTitle="Add"
        buttonClick={setAddPopup}
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
        />
      )}
    </>
  );
};

export default Rooms;
