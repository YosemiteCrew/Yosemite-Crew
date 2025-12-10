import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Modal from "@/app/components/Modal";
import { Speciality } from "@/app/types/org";
import React from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

type SpecialityInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeSpeciality: Speciality;
};

const ServiceFields = [
  { label: "Description", key: "description", type: "text" },
  { label: "Duration (mins)", key: "duration", type: "text" },
  { label: "Service charge (USD)", key: "charge", type: "text" },
  { label: "Max discount (%)", key: "maxDiscount", type: "text" },
];

const BasicFields = [
  { label: "Name", key: "name", type: "text" },
  { label: "Head", key: "head", type: "text" },
];

const SpecialityInfo = ({
  showModal,
  setShowModal,
  activeSpeciality,
}: SpecialityInfoProps) => {
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
            View speciality
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className={`px-3! py-2! flex items-center gap-2`}>
          <div className="font-satoshi font-semibold text-black-text text-[23px] overflow-scroll scrollbar-hidden">
            {activeSpeciality.name || "-"}
          </div>
        </div>

        <EditableAccordion
          key={activeSpeciality.name + "core-key"}
          title={"Core"}
          fields={BasicFields}
          data={activeSpeciality}
          defaultOpen={true}
        />

        <Accordion
          key={activeSpeciality.name}
          title={"Services"}
          defaultOpen={true}
          showEditIcon={false}
          isEditing={false}
        >
          <div className="flex flex-col gap-3">
            {activeSpeciality.services?.map((service) => (
              <EditableAccordion
                key={service.name}
                title={service.name}
                fields={ServiceFields}
                data={service}
                defaultOpen={false}
              />
            ))}
          </div>
        </Accordion>
      </div>
    </Modal>
  );
};

export default SpecialityInfo;
