import Accordion from "@/app/components/Accordion/Accordion";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Modal from "@/app/components/Modal";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { SpecialityOptions, StaffOptions } from "../../types";
import { Primary } from "@/app/components/Buttons";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";

type AddRoomProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const AddRoom = ({ showModal, setShowModal }: AddRoomProps) => {
  const [formData, setFormData] = useState<any>({
    name: "",
    type: "",
    specialities: [],
    staff: [],
  });
  const [formDataErrors] = useState<{
    name?: string;
  }>({});

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
            Add room
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className="flex overflow-y-auto flex-1 w-full flex-col gap-6 justify-between">
          <Accordion
            title="Add room"
            defaultOpen
            showEditIcon={false}
            isEditing={true}
          >
            <div className="flex flex-col gap-3">
              <FormInput
                intype="text"
                inname="name"
                value={formData.name}
                inlabel="Name"
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                error={formDataErrors.name}
                className="min-h-12!"
              />
              <FormInput
                intype="text"
                inname="type"
                value={formData.type}
                inlabel="Type"
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="min-h-12!"
              />
              <MultiSelectDropdown
                placeholder="Assigned specialities"
                value={formData.specialities}
                onChange={(e) => setFormData({ ...formData, specialities: e })}
                className="min-h-12!"
                options={SpecialityOptions}
                dropdownClassName="h-fit!"
              />
              <MultiSelectDropdown
                placeholder="Assigned staff"
                value={formData.staff}
                onChange={(e) => setFormData({ ...formData, staff: e })}
                className="min-h-12!"
                options={StaffOptions}
                dropdownClassName="h-fit!"
              />
            </div>
          </Accordion>
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

export default AddRoom;
