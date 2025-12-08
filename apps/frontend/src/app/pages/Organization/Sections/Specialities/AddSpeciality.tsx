import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import SpecialitySearch from "@/app/components/Inputs/SpecialitySearch/SpecialitySearch";
import Modal from "@/app/components/Modal";
import { Speciality } from "@/app/types/org";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import SpecialityCard from "./SpecialityCard";

type AddSpecialityProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const AddSpeciality = ({ showModal, setShowModal }: AddSpecialityProps) => {
  const [formData, setFormData] = useState<Speciality[]>([]);

  const removeSpeciality = (index: number) => {
    setFormData((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex items-center justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            Add specialities
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className="flex overflow-y-auto flex-1 w-full flex-col gap-6 justify-between">
          <div className="flex flex-col gap-3">
            {/* <SpecialitySearch
              specialities={formData}
              setSpecialities={setFormData}
            /> */}
            {formData.map((speciality, i) => (
              <Accordion
                key={speciality.name}
                title={speciality.name}
                defaultOpen
                showEditIcon={false}
                isEditing={false}
                showDeleteIcon
                onDeleteClick={() => removeSpeciality(i)}
              >
                <SpecialityCard
                  setFormData={setFormData}
                  speciality={speciality}
                  index={i}
                />
              </Accordion>
            ))}
          </div>
          <Primary
            href="#"
            text="Save"
            classname="max-h-12! text-lg! tracking-wide!"
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddSpeciality;
