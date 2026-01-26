import EditableAccordion, {
  FieldConfig,
} from "@/app/components/Accordion/EditableAccordion";
import { usePermissions } from "@/app/hooks/usePermissions";
import { useRoomsForPrimaryOrg } from "@/app/hooks/useRooms";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { updateAppointment } from "@/app/services/appointmentService";
import { AppointmentStatusOptions } from "@/app/types/appointments";
import { PERMISSIONS } from "@/app/utils/permissions";
import { Appointment } from "@yosemite-crew/types";
import React, { useMemo } from "react";

const getAppointmentFields = ({
  RoomOptions,
}: {
  RoomOptions: { label: string; value: string }[];
}) =>
  [
    { label: "Reason", key: "concern", type: "text" },
    {
      label: "Room",
      key: "room",
      type: "dropdown",
      options: RoomOptions,
    },
    {
      label: "Service",
      key: "service",
      type: "text",
      editable: false,
    },
    {
      label: "Date",
      key: "date",
      type: "date",
      editable: false,
    },
    {
      label: "Time",
      key: "time",
      type: "time",
      editable: false,
    },
    {
      label: "Status",
      key: "status",
      type: "select",
      options: AppointmentStatusOptions,
    },
  ] satisfies FieldConfig[];

const getStaffFields = ({
  TeamOptions,
}: {
  TeamOptions: { label: string; value: string }[];
}) =>
  [
    {
      label: "Lead",
      key: "lead",
      type: "select",
      options: TeamOptions,
      editable: false,
    },
    {
      label: "Staff",
      key: "staff",
      type: "multiSelect",
      options: TeamOptions,
    },
  ] satisfies FieldConfig[];

type AppointmentInfoProps = {
  activeAppointment: Appointment;
};

const AppointmentInfo = ({ activeAppointment }: AppointmentInfoProps) => {
  const rooms = useRoomsForPrimaryOrg();
  const teams = useTeamForPrimaryOrg();
  const { can } = usePermissions();
  const canEditAppointments = can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);

  const RoomOptions = useMemo(
    () =>
      rooms?.map((room) => ({
        label: room.name,
        value: room.id,
      })),
    [rooms],
  );

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId || team._id,
        value: team.practionerId || team._id,
      })),
    [teams],
  );

  const staffFields = useMemo(
    () => getStaffFields({ TeamOptions }),
    [TeamOptions],
  );

  const appointmentFields = useMemo(
    () => getAppointmentFields({ RoomOptions }),
    [RoomOptions],
  );

  const AppointmentInfoData = useMemo(
    () => ({
      concern: activeAppointment.concern ?? "",
      room: activeAppointment.room?.id ?? "",
      service: activeAppointment.appointmentType?.name ?? "",
      date: activeAppointment.appointmentDate ?? "",
      time: activeAppointment.startTime ?? "",
      status: activeAppointment.status ?? "",
    }),
    [activeAppointment],
  );

  const StaffInfoData = useMemo(
    () => ({
      lead: activeAppointment.lead?.id ?? "",
      staff: activeAppointment.supportStaff?.map((s) => s.id) ?? "",
    }),
    [activeAppointment],
  );

  const handleAppointmentUpdate = async (values: any) => {
    try {
      const roomId = values.room;
      const foundRoom = rooms.find((r) => r.id === roomId);
      const room = foundRoom
        ? { id: foundRoom.id, name: foundRoom.name }
        : undefined;
      const formData: Appointment = {
        ...activeAppointment,
        concern: values.concern,
        room,
        status: values.status,
      };
      await updateAppointment(formData);
    } catch (error) {
      console.log(error);
    }
  };

  const handleStaffUpdate = async (values: any) => {
    try {
      const teamIds = values.staff;
      const team =
        teamIds?.length > 0
          ? teams
              .filter((member) => {
                const memberId = member.practionerId || member._id;
                return memberId ? teamIds.includes(memberId) : false;
              })
              .map((member) => ({
                id: member.practionerId || member._id,
                name: member.name || member.practionerId || member._id,
              }))
          : [];
      const formData: Appointment = {
        ...activeAppointment,
        supportStaff: team,
      };
      await updateAppointment(formData);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <EditableAccordion
        key={"Appointments-key"}
        title={"Appointments details"}
        fields={appointmentFields}
        data={AppointmentInfoData}
        defaultOpen={true}
        onSave={handleAppointmentUpdate}
        showEditIcon={canEditAppointments}
      />
      <EditableAccordion
        key={"staff-key"}
        title={"Staff details"}
        fields={staffFields}
        data={StaffInfoData}
        defaultOpen={true}
        onSave={handleStaffUpdate}
        showEditIcon={canEditAppointments}
      />
    </div>
  );
};

export default AppointmentInfo;
