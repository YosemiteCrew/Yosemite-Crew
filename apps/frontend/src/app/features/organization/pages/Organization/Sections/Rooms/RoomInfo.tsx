import EditableAccordion, {
  FieldConfig,
} from "@/app/ui/primitives/Accordion/EditableAccordion";
import Modal from "@/app/ui/overlays/Modal";
import { OrganisationRoom } from "@yosemite-crew/types";
import React, { useMemo } from "react";
import { RoomsTypes } from "@/app/features/organization/pages/Organization/types";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import {
  deleteRoom,
  updateRoom,
} from "@/app/features/organization/services/roomService";
import Close from "@/app/ui/primitives/Icons/Close";
import { useNotify } from "@/app/hooks/useNotify";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      message?: string;
      response?: {
        data?: {
          message?: string;
        };
      };
    };

    return maybeError.response?.data?.message ?? maybeError.message ?? fallback;
  }

  return fallback;
};

type RoomInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeRoom: OrganisationRoom;
  canEditRoom: boolean;
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
    { label: "Type", key: "type", type: "dropdown", options: RoomsTypes },
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

const RoomInfo = ({
  showModal,
  setShowModal,
  activeRoom,
  canEditRoom,
}: RoomInfoProps) => {
  const { notify } = useNotify();
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId,
        value: team.practionerId,
      })),
    [teams],
  );

  const SpecialitiesOptions = useMemo(
    () =>
      specialities?.map((speciality) => ({
        label: speciality.name,
        value: speciality._id || speciality.name,
      })),
    [specialities],
  );

  const fields = useMemo(
    () => getFields({ TeamOptions, SpecialitiesOptions }),
    [TeamOptions, SpecialitiesOptions],
  );

  const roomInfoData = useMemo(
    () => ({
      name: activeRoom?.name ?? "",
      type: activeRoom?.type ?? "",
      assignedSpecialiteis: activeRoom?.assignedSpecialiteis ?? "",
      assignedStaffs: activeRoom?.assignedStaffs ?? "",
    }),
    [activeRoom],
  );

  const handleUpdate = async (values: any) => {
    try {
      const formData: OrganisationRoom = {
        id: activeRoom.id,
        organisationId: activeRoom.organisationId,
        name: values.name,
        type: values.type,
        assignedSpecialiteis: values.assignedSpecialiteis,
        assignedStaffs: values.assignedStaffs,
      };
      await updateRoom(formData);
      notify("success", {
        title: "Room updated",
        text: "Room details have been updated successfully.",
      });
      setShowModal(false);
    } catch (error) {
      notify("error", {
        title: "Unable to update room",
        text: getErrorMessage(
          error,
          "Failed to update room. Please try again.",
        ),
      });
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRoom(activeRoom);
      notify("success", {
        title: "Room deleted",
        text: "Room has been deleted successfully.",
      });
      setShowModal(false);
    } catch (error) {
      notify("error", {
        title: "Unable to delete room",
        text: getErrorMessage(
          error,
          "Failed to delete room. Please try again.",
        ),
      });
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
            <div className="text-body-1 text-text-primary">View room</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <EditableAccordion
          title="Room details"
          fields={fields}
          data={roomInfoData}
          defaultOpen={true}
          showEditIcon={canEditRoom}
          onSave={handleUpdate}
          showDeleteIcon={canEditRoom}
          onDelete={handleDelete}
        />
      </div>
    </Modal>
  );
};

export default RoomInfo;
