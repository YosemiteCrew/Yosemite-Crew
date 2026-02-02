import Accordion from "@/app/ui/primitives/Accordion/Accordion";
import { Primary } from "@/app/ui/primitives/Buttons";
import Modal from "@/app/ui/overlays/Modal";
import React, { useState } from "react";
import SpecialityCard from "@/app/features/organization/pages/Organization/Sections/Specialities/SpecialityCard";
import { SpecialityWeb } from "@/app/features/organization/types/speciality";
import SpecialitySearchWeb from "@/app/ui/inputs/SpecialitySearch/SpecialitySearchWeb";
import { createBulkSpecialityServices } from "@/app/features/organization/services/specialityService";
import Close from "@/app/ui/primitives/Icons/Close";

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
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
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
