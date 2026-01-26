import Accordion from "@/app/components/Accordion/Accordion";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Modal from "@/app/components/Modal";
import React, { useMemo, useState } from "react";
import { EmploymentTypes, RoleOptions } from "../../types";
import { Primary } from "@/app/components/Buttons";
import SelectLabel from "@/app/components/Inputs/SelectLabel";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { sendInvite } from "@/app/services/teamService";
import { isValidEmail } from "@/app/utils/validators";
import { TeamFormDataType } from "@/app/types/team";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import Close from "@/app/components/Icons/Close";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import { useSubscriptionCounterUpdate } from "@/app/hooks/useStripeOnboarding";
import { useCanMoreForPrimaryOrg } from "@/app/hooks/useBilling";
import { IoIosWarning } from "react-icons/io";

type AddTeamProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const initialData = {
  email: "",
  speciality: [],
  role: "",
  type: EmploymentTypes[0].value,
};

const AddTeam = ({ showModal, setShowModal }: AddTeamProps) => {
  const specialities = useSpecialitiesForPrimaryOrg();
  const { refetch: refetchData } = useSubscriptionCounterUpdate();
  const { canMore, reason } = useCanMoreForPrimaryOrg("users");
  const [formData, setFormData] = useState<TeamFormDataType>(initialData);
  const [formDataErrors, setFormDataErrors] = useState<{
    email?: string;
    speciality?: string;
    role?: string;
    booking?: string;
  }>({});

  const SpecialitiesOptions = useMemo(
    () => specialities.map((s) => ({ label: s.name, value: s._id || s.name })),
    [specialities],
  );

  const handleSave = async () => {
    const errors: {
      email?: string;
      speciality?: string;
      role?: string;
      booking?: string;
    } = {};
    if (!canMore) {
      errors.booking =
        reason === "limit_reached"
          ? "You’ve reached your free user limit. Please upgrade to book more."
          : "We couldn’t verify your users limit right now. Please try again.";
    }
    if (!formData.email) errors.email = "Email is required";
    if (formData.speciality.length === 0)
      errors.speciality = "Speciality is required";
    if (!formData.role) errors.role = "Role is required";
    if (!isValidEmail(formData.email)) errors.email = "Enter a valid email";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await sendInvite(formData);
      await refetchData();
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
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
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
              <MultiSelectDropdown
                placeholder="Speciality"
                value={formData.speciality}
                onChange={(e) => setFormData({ ...formData, speciality: e })}
                options={SpecialitiesOptions}
                error={formDataErrors.speciality}
              />
              <LabelDropdown
                placeholder="Role"
                onSelect={(option) =>
                  setFormData({ ...formData, role: option.value })
                }
                defaultOption={formData.role}
                error={formDataErrors.role}
                options={RoleOptions.slice(1)}
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
          <div className="flex flex-col items-end gap-2 w-full">
            {formDataErrors.booking && (
              <div className="mt-1.5 flex items-center gap-1 px-2 text-caption-2 text-text-error">
                <IoIosWarning className="text-text-error" size={14} />
                <span>{formDataErrors.booking}</span>
              </div>
            )}
            <Primary
              href="#"
              text="Send invite"
              onClick={handleSave}
              classname="w-full"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddTeam;
