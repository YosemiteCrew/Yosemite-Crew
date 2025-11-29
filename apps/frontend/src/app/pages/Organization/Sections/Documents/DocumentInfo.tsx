import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Modal from "@/app/components/Modal";
import React from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

type DocumentInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeDocument: any;
};

const Fields = [
  { label: "Title", key: "title", type: "text" },
  { label: "Description", key: "description", type: "text" },
  { label: "Created on", key: "date", type: "text" },
  { label: "Last updated on", key: "lastUpdated", type: "text" },
]

const DocumentInfo = ({
  showModal,
  setShowModal,
  activeDocument,
}: DocumentInfoProps) => {
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
            View document
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <EditableAccordion
          title="Document info"
          fields={Fields}
          data={activeDocument}
          defaultOpen={true}
        />
      </div>
    </Modal>
  );
};

export default DocumentInfo;
