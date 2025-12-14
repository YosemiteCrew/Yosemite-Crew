import Accordion from "@/app/components/Accordion/Accordion";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Modal from "@/app/components/Modal";
import React, { useMemo, useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { EmploymentTypes, RoleOptions } from "../../types";
import { Primary } from "@/app/components/Buttons";
import SelectLabel from "@/app/components/Inputs/SelectLabel";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { sendInvite } from "@/app/services/teamService";
import { isValidEmail } from "@/app/utils/validators";
import { TeamFormDataType } from "@/app/types/team";

type AddTeamProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const initialData = {
  email: "",
  speciality: {
    name: "",
    key: "",
  },
  role: "",
  type: EmploymentTypes[0].key,
};

const AddTeam = ({ showModal, setShowModal }: AddTeamProps) => {
  const specialities = useSpecialitiesForPrimaryOrg();
  const [formData, setFormData] = useState<TeamFormDataType>(initialData);
  const [formDataErrors, setFormDataErrors] = useState<{
    email?: string;
    speciality?: string;
    role?: string;
  }>({});

  const SpecialitiesOptions = useMemo(
    () => specialities.map((s) => ({ label: s.name, value: s._id || s.name })),
    [specialities]
  );

  const handleSave = async () => {
    const errors: { email?: string; speciality?: string; role?: string } = {};
    if (!formData.email) errors.email = "Email is required";
    if (!formData.speciality.name) errors.speciality = "Speciality is required";
    if (!formData.role) errors.role = "Role is required";
    if (!isValidEmail(formData.email)) errors.email = "Enter a valid email";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await sendInvite(formData);
      setShowModal(false);
      setFormData(initialData);
    } catch (error) {
      console.log(error);
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
            Add team
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
            title="Add team"
            defaultOpen
            showEditIcon={false}
            isEditing={true}
          >
            <div className="flex flex-col gap-3">
              <FormInput
                intype="email"
                inname="email"
                value={formData.email}
                inlabel="Email"
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                error={formDataErrors.email}
                className="min-h-12!"
              />
              <Dropdown
                placeholder="Speciality"
                value={formData.speciality.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    speciality: e,
                  })
                }
                error={formDataErrors.speciality}
                className="min-h-12!"
                dropdownClassName="top-[55px]! !h-fit !max-h-[200px]"
                options={SpecialitiesOptions}
                type="general"
              />
              <Dropdown
                placeholder="Role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e })}
                error={formDataErrors.role}
                className="min-h-12!"
                dropdownClassName="top-[55px]! !h-fit !max-h-[200px]"
                options={RoleOptions}
              />
              <SelectLabel
                title="Employee type"
                options={EmploymentTypes}
                activeOption={formData.type}
                setOption={(value: string) =>
                  setFormData({ ...formData, type: value })
                }
                type="coloumn"
              />
            </div>
          </Accordion>
          <Primary
            href="#"
            text="Save"
            classname="max-h-12! text-lg! tracking-wide!"
            onClick={handleSave}
          />
        </div>
      </div>
    </Modal>
  );
};

export default AddTeam;
