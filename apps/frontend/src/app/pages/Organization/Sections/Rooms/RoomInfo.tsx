import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Modal from "@/app/components/Modal";
import React from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

type RoomInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeRoom: any;
};

const Fields = [
  { label: "Name", key: "name", type: "text" },
  { label: "Type", key: "type", type: "text" },
  { label: "Assigned speciality", key: "assignedSpeciality", type: "text" },
  { label: "Assigned staff", key: "assignedStaff", type: "text" },
]

const RoomInfo = ({ showModal, setShowModal, activeRoom }: RoomInfoProps) => {
  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            View room
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <EditableAccordion
          title="Room details"
          fields={Fields}
          data={activeRoom}
          defaultOpen={true}
        />
      </div>
    </Modal>
  );
};

export default RoomInfo;
