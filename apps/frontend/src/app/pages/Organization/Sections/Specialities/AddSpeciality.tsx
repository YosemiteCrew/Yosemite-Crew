import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import Modal from "@/app/components/Modal";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import SpecialityCard from "./SpecialityCard";
import { SpecialityWeb } from "@/app/types/speciality";
import SpecialitySearchWeb from "@/app/components/Inputs/SpecialitySearch/SpecialitySearchWeb";
import { createBulkSpecialityServices } from "@/app/services/specialityService";

type AddSpecialityProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  specialities: SpecialityWeb[];
};

const AddSpeciality = ({
  showModal,
  setShowModal,
  specialities,
}: AddSpecialityProps) => {
  const [formData, setFormData] = useState<SpecialityWeb[]>([]);

  const removeSpeciality = (index: number) => {
    setFormData((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      await createBulkSpecialityServices(formData);
      setShowModal(false);
    } catch (err) {
      console.error("Failed to save specialities:", err);
    }
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
            <SpecialitySearchWeb
              specialities={formData}
              setSpecialities={setFormData}
              currentSpecialities={specialities}
            />
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
            onClick={handleSubmit}
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddSpeciality;
