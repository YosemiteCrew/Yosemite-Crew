import Accordion from "@/app/components/Accordion/Accordion";
import { Primary } from "@/app/components/Buttons";
import Modal from "@/app/components/Modal";
import React, { useState } from "react";
import SpecialityCard from "./SpecialityCard";
import { SpecialityWeb } from "@/app/types/speciality";
import SpecialitySearchWeb from "@/app/components/Inputs/SpecialitySearch/SpecialitySearchWeb";
import { createBulkSpecialityServices } from "@/app/services/specialityService";
import Close from "@/app/components/Icons/Close";

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
      console.log(formData);
      await createBulkSpecialityServices(formData);
      setFormData([]);
      setShowModal(false);
    } catch (err) {
      console.error("Failed to save specialities:", err);
    }
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">
              Add specialities
            </div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <div className="flex overflow-y-auto flex-1 w-full flex-col gap-6 justify-between scrollbar-hidden">
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
