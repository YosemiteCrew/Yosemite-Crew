import Accordion from "@/app/components/Accordion/Accordion";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Modal from "@/app/components/Modal";
import React, { useMemo, useState } from "react";
import { EmploymentTypes, RoleOptions } from "../../types";
import { Primary } from "@/app/components/Buttons";
import SelectLabel from "@/app/components/Inputs/SelectLabel";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { sendInvite } from "@/app/services/teamService";
import { isValidEmail, toTitleCase } from "@/app/utils/validators";
import { TeamFormDataType } from "@/app/types/team";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import Close from "@/app/components/Icons/Close";

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
  type: EmploymentTypes[0].value,
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
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Add team</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <div className="flex overflow-y-auto flex-1 w-full flex-col gap-6 justify-between scrollbar-hidden">
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
              <LabelDropdown
                placeholder="Speciality"
                onSelect={(option) =>
                  setFormData({
                    ...formData,
                    speciality: {
                      name: option.label,
                      key: option.value,
                    },
                  })
                }
                defaultOption={formData.speciality.key}
                error={formDataErrors.speciality}
                options={SpecialitiesOptions}
              />
              <LabelDropdown
                placeholder="Role"
                onSelect={(option) =>
                  setFormData({ ...formData, role: option.value })
                }
                defaultOption={formData.role}
                error={formDataErrors.role}
                options={RoleOptions.map((role) => ({
                  value: role,
                  label: toTitleCase(role),
                }))}
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
