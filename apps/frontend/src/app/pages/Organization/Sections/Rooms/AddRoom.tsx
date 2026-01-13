import Accordion from "@/app/components/Accordion/Accordion";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Modal from "@/app/components/Modal";
import React, { useMemo, useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { RoomsTypes } from "../../types";
import { Primary } from "@/app/components/Buttons";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import { OrganisationRoom } from "@yosemite-crew/types";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { createRoom } from "@/app/services/roomService";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";

type AddRoomProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const INITIAL_FORM_DATA: OrganisationRoom = {
  id: "",
  organisationId: "",
  name: "",
  type: "CONSULTATION",
  assignedSpecialiteis: [],
  assignedStaffs: [],
};

const AddRoom = ({ showModal, setShowModal }: AddRoomProps) => {
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();
  const [formData, setFormData] = useState<OrganisationRoom>(INITIAL_FORM_DATA);
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
  }>({});

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team._id,
        value: team._id,
      })),
    [teams]
  );

  const SpecialitiesOptions = useMemo(
    () =>
      specialities?.map((speciality) => ({
        label: speciality.name,
        value: speciality._id || speciality.name,
      })),
    [specialities]
  );

  const handleSave = async () => {
    const errors: { name?: string } = {};
    if (!formData.name) errors.name = "Name is required";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await createRoom(formData);
      setShowModal(false);
      setFormData(INITIAL_FORM_DATA);
      setFormDataErrors({});
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
              <LabelDropdown
                placeholder="Type"
                onSelect={(option) =>
                  setFormData({
                    ...formData,
                    type: option.key as any,
                  })
                }
                defaultOption={formData.type}
                options={RoomsTypes}
              />
              <MultiSelectDropdown
                placeholder="Assigned specialities"
                value={formData.assignedSpecialiteis || []}
                onChange={(e) =>
                  setFormData({ ...formData, assignedSpecialiteis: e })
                }
                className="min-h-12!"
                options={SpecialitiesOptions}
                dropdownClassName="h-fit!"
              />
              <MultiSelectDropdown
                placeholder="Assigned staff"
                value={formData.assignedStaffs || []}
                onChange={(e) =>
                  setFormData({ ...formData, assignedStaffs: e })
                }
                className="min-h-12!"
                options={TeamOptions}
                dropdownClassName="h-fit!"
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

export default AddRoom;
