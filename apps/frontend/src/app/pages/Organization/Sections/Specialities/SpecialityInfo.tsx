import Accordion from "@/app/components/Accordion/Accordion";
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Modal from "@/app/components/Modal";
import { updateService, updateSpeciality } from "@/app/services/specialityService";
import { SpecialityWeb } from "@/app/types/speciality";
import { Service, Speciality } from "@yosemite-crew/types";
import React from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

type SpecialityInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeSpeciality: SpecialityWeb;
};

const ServiceFields = [
  { label: "Description", key: "description", type: "text" },
  {
    label: "Duration (mins)",
    key: "durationMinutes",
    type: "number",
    required: true,
  },
  { label: "Service charge (USD)", key: "cost", type: "number", required: true },
  { label: "Max discount (%)", key: "maxDiscount", type: "number" },
];

const BasicFields = [
  { label: "Name", key: "name", type: "text", required: true },
  { label: "Head", key: "headName", type: "text" },
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
          onSave={async (values) => {
            const payload: Speciality = {
              ...activeSpeciality,
              name: values.name ?? activeSpeciality.name,
              headName: values.headName ?? activeSpeciality.headName,
              services: [],
            };
            await updateSpeciality(payload);
          }}
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
                onSave={async (values) => {
                  const payload: Service = {
                    ...service,
                    name: values.name ?? service.name,
                    description:
                      values.description ?? service.description ?? null,
                    durationMinutes: Number(
                      values.durationMinutes ?? service.durationMinutes
                    ),
                    cost: Number(values.cost ?? service.cost),
                    maxDiscount:
                      values.maxDiscount === "" || values.maxDiscount == null
                        ? null
                        : Number(values.maxDiscount),
                  };
                  await updateService(payload);
                }}
              />
            ))}
          </div>
        </Accordion>
      </div>
    </Modal>
  );
};

export default SpecialityInfo;
