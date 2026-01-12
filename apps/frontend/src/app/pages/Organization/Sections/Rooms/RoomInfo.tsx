import EditableAccordion, {
  FieldConfig,
} from "@/app/components/Accordion/EditableAccordion";
import Modal from "@/app/components/Modal";
import { OrganisationRoom } from "@yosemite-crew/types";
import React, { useMemo } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";
import { RoomsTypes2 } from "../../types";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { updateRoom } from "@/app/services/roomService";

type RoomInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeRoom: OrganisationRoom;
};

const getFields = ({
  TeamOptions,
  SpecialitiesOptions,
}: {
  TeamOptions: { label: string; value: string }[];
  SpecialitiesOptions: { label: string; value: string }[];
}) =>
  [
    { label: "Name", key: "name", type: "text", required: true },
    { label: "Type", key: "type", type: "dropdown", options: RoomsTypes2 },
    {
      label: "Assigned speciality",
      key: "assignedSpecialiteis",
      type: "multiSelect",
      options: SpecialitiesOptions,
    },
    {
      label: "Assigned staff",
      key: "assignedStaffs",
      type: "multiSelect",
      options: TeamOptions,
    },
  ] satisfies FieldConfig[];

const RoomInfo = ({ showModal, setShowModal, activeRoom }: RoomInfoProps) => {
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();

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

  const fields = useMemo(
    () => getFields({ TeamOptions, SpecialitiesOptions }),
    [TeamOptions, SpecialitiesOptions]
  );

  const roomInfoData = useMemo(
    () => ({
      name: activeRoom?.name ?? "",
      type: activeRoom?.type ?? "",
      assignedSpecialiteis: activeRoom?.assignedSpecialiteis ?? "",
      assignedStaffs: activeRoom?.assignedStaffs ?? "",
    }),
    [activeRoom]
  );

  const handleUpdate = async (values: any) => {
    try {
      const formData: OrganisationRoom = {
        id: activeRoom.id,
        organisationId: activeRoom.id,
        name: values.name,
        type: values.type,
        assignedSpecialiteis: values.assignedSpecialiteis,
        assignedStaffs: values.assignedStaffs,
      };
      await updateRoom(formData);
      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            View room
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <EditableAccordion
          title="Room details"
          fields={fields}
          data={roomInfoData}
          defaultOpen={true}
          onSave={handleUpdate}
        />
      </div>
    </Modal>
  );
};

export default RoomInfo;
