import Accordion from "@/app/components/Accordion/Accordion";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Modal from "@/app/components/Modal";
import React, { useMemo, useState } from "react";
import { RoomsTypes } from "../../types";
import { Primary } from "@/app/components/Buttons";
import MultiSelectDropdown from "@/app/components/Inputs/MultiSelectDropdown";
import { OrganisationRoom } from "@yosemite-crew/types";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { createRoom } from "@/app/services/roomService";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import Close from "@/app/components/Icons/Close";

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
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Add room</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <div className="flex overflow-y-auto flex-1 w-full flex-col gap-6 justify-between scrollbar-hidden">
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
                    type: option.value as any,
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
                options={SpecialitiesOptions}
              />
              <MultiSelectDropdown
                placeholder="Assigned staff"
                value={formData.assignedStaffs || []}
                onChange={(e) =>
                  setFormData({ ...formData, assignedStaffs: e })
                }
                options={TeamOptions}
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
